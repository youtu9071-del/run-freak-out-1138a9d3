-- =========================================================
-- 1) Auto-expire team challenges (open => cancelled, active => completed)
-- =========================================================
CREATE OR REPLACE FUNCTION public.expire_team_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch RECORD;
  v_member RECORD;
BEGIN
  -- Open challenges past end_date => cancelled (no team B accepted)
  FOR ch IN
    SELECT id, team_a_id FROM public.challenges
    WHERE status = 'open' AND end_date IS NOT NULL AND end_date < now()
  LOOP
    UPDATE public.challenges SET status = 'cancelled' WHERE id = ch.id;
    -- Notify team A creator
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT t.creator_id, 'challenge_cancelled', 'Défi expiré ⏰',
           'Ton défi d''équipe a expiré sans adversaire', ch.id
    FROM public.teams t WHERE t.id = ch.team_a_id;
  END LOOP;

  -- Active challenges past end_date => try finalize, else mark completed and notify
  FOR ch IN
    SELECT id, team_a_id, team_b_id FROM public.challenges
    WHERE status = 'active' AND end_date IS NOT NULL AND end_date < now()
  LOOP
    BEGIN
      PERFORM public.finalize_team_challenge(ch.id);
    EXCEPTION WHEN OTHERS THEN
      -- Members didn't all finish — mark completed without winner
      UPDATE public.challenges SET status = 'completed' WHERE id = ch.id;
      FOR v_member IN
        SELECT t.creator_id AS user_id FROM public.teams t
        WHERE t.id IN (ch.team_a_id, ch.team_b_id)
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, related_id)
        VALUES (v_member.user_id, 'challenge_expired', 'Défi terminé ⏰',
                'Le défi est expiré : tous les membres n''ont pas terminé. Aucun FP attribué.', ch.id);
      END LOOP;
    END;
  END LOOP;
END;
$$;

-- Add 'cancelled' to challenge_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.challenge_status'::regtype
      AND enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE public.challenge_status ADD VALUE 'cancelled';
  END IF;
END$$;

-- =========================================================
-- 2) Atomic purchase with FP deduction
-- =========================================================
CREATE OR REPLACE FUNCTION public.purchase_with_fp(
  p_product_id uuid,
  p_fp_to_use numeric
)
RETURNS TABLE(qr_id uuid, qr_uid text, qr_data text, total_price numeric, discount_amount numeric, fp_used numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_product RECORD;
  v_user_fp numeric;
  v_fp_used numeric;
  v_discount numeric;
  v_total numeric;
  v_uid text;
  v_data text;
  v_qr_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND in_stock = true;
  IF v_product IS NULL THEN
    RAISE EXCEPTION 'Product not available';
  END IF;

  v_fp_used := GREATEST(0, COALESCE(p_fp_to_use, 0));
  IF v_fp_used > v_product.max_fp_discount THEN
    RAISE EXCEPTION 'FP discount exceeds product max (% FP)', v_product.max_fp_discount;
  END IF;

  -- Lock the profile row to prevent race conditions
  SELECT total_fp INTO v_user_fp FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  IF v_user_fp IS NULL THEN v_user_fp := 0; END IF;

  IF v_fp_used > v_user_fp THEN
    RAISE EXCEPTION 'INSUFFICIENT_FP: solde % FP, requis % FP', v_user_fp, v_fp_used;
  END IF;

  v_discount := LEAST(v_fp_used * COALESCE(v_product.fp_discount_rate, 0), v_product.price * 0.5);
  v_total := GREATEST(v_product.price - v_discount, 0);

  -- Deduct FP
  IF v_fp_used > 0 THEN
    UPDATE public.profiles SET total_fp = total_fp - v_fp_used, updated_at = now()
      WHERE user_id = v_user;
  END IF;

  v_uid := replace(gen_random_uuid()::text, '-', '');
  v_data := v_uid; -- the public scan URL is built client-side from this UID

  INSERT INTO public.purchase_qrcodes (user_id, product_id, fp_used, discount_amount, total_price, qr_data, qr_uid)
  VALUES (v_user, p_product_id, v_fp_used, v_discount, v_total, v_data, v_uid)
  RETURNING id INTO v_qr_id;

  INSERT INTO public.orders (user_id, product_id, total_price, fp_used, discount_amount)
  VALUES (v_user, p_product_id, v_total, v_fp_used, v_discount);

  RETURN QUERY SELECT v_qr_id, v_uid, v_data, v_total, v_discount, v_fp_used;
END;
$$;