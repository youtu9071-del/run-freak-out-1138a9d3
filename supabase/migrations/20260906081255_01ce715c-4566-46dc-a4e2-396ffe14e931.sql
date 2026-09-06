-- 1. Produits Mobile Money -------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS operator text,
  ADD COLUMN IF NOT EXISTS payout_amount numeric,
  ADD COLUMN IF NOT EXISTS payout_currency text NOT NULL DEFAULT 'FCFA';

-- 2. Commandes Mobile Money -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mobile_money_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  operator text NOT NULL,
  country text,
  payout_amount numeric NOT NULL,
  payout_currency text NOT NULL DEFAULT 'FCFA',
  fp_price numeric NOT NULL,
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  refunded boolean NOT NULL DEFAULT false,
  admin_note text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mobile_money_orders TO authenticated;
GRANT ALL ON public.mobile_money_orders TO service_role;
ALTER TABLE public.mobile_money_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own mm orders" ON public.mobile_money_orders;
CREATE POLICY "Users read own mm orders" ON public.mobile_money_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS mm_orders_updated_at ON public.mobile_money_orders;
CREATE TRIGGER mm_orders_updated_at BEFORE UPDATE ON public.mobile_money_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS mm_orders_user_idx ON public.mobile_money_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mm_orders_status_idx ON public.mobile_money_orders(status, created_at DESC);

-- 3. Achat Mobile Money -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_mobile_money(p_product_id uuid, p_phone text)
RETURNS TABLE(order_id uuid, order_number text, status text, fp_price numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_p RECORD; v_fp numeric; v_cost numeric; v_num text; v_id uuid;
  v_phone text := btrim(coalesce(p_phone, ''));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;

  SELECT * INTO v_p FROM public.products
    WHERE id = p_product_id AND product_type = 'mobile_money' AND in_stock = true FOR UPDATE;
  IF v_p IS NULL THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  IF v_p.stock_quantity IS NOT NULL AND v_p.stock_quantity <= 0 THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;

  v_cost := COALESCE(v_p.max_fp_discount, 0);
  IF v_cost <= 0 THEN RAISE EXCEPTION 'INVALID_PRICE'; END IF;

  SELECT COALESCE(total_fp, 0) INTO v_fp FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  IF v_fp < v_cost THEN RAISE EXCEPTION 'INSUFFICIENT_FP: solde % FP, requis % FP', v_fp, v_cost; END IF;

  -- anti double-clic : pas deux commandes identiques en 60 s
  IF EXISTS (
    SELECT 1 FROM public.mobile_money_orders
    WHERE user_id = v_user AND product_id = p_product_id AND created_at > now() - interval '60 seconds'
  ) THEN RAISE EXCEPTION 'DUPLICATE_ORDER'; END IF;

  UPDATE public.profiles SET total_fp = total_fp - v_cost, updated_at = now() WHERE user_id = v_user;

  IF v_p.stock_quantity IS NOT NULL THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity - 1,
          in_stock = CASE WHEN stock_quantity - 1 <= 0 THEN false ELSE in_stock END
      WHERE id = p_product_id;
  END IF;

  v_num := 'MM-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.mobile_money_orders
    (order_number, user_id, product_id, product_name, operator, country,
     payout_amount, payout_currency, fp_price, phone_number, status)
  VALUES
    (v_num, v_user, p_product_id, v_p.name, COALESCE(v_p.operator, v_p.name), v_p.country,
     COALESCE(v_p.payout_amount, v_p.price), COALESCE(v_p.payout_currency, v_p.currency), v_cost, v_phone, 'pending')
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_num, 'pending'::text, v_cost;
END; $$;

REVOKE ALL ON FUNCTION public.purchase_mobile_money(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_mobile_money(uuid, text) TO authenticated;

-- 4. Traitement admin -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_mm_order(p_order_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_o RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('pending','processing','sent','failed','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  SELECT * INTO v_o FROM public.mobile_money_orders WHERE id = p_order_id FOR UPDATE;
  IF v_o.id IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_o.status IN ('sent','cancelled','failed') THEN RAISE EXCEPTION 'ORDER_ALREADY_CLOSED'; END IF;

  IF p_status IN ('failed','cancelled') AND NOT v_o.refunded THEN
    UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_o.fp_price, updated_at = now()
      WHERE user_id = v_o.user_id;
    UPDATE public.mobile_money_orders SET refunded = true WHERE id = p_order_id;
  END IF;

  UPDATE public.mobile_money_orders
    SET status = p_status,
        admin_note = COALESCE(p_note, admin_note),
        processed_by = CASE WHEN p_status IN ('sent','failed','cancelled') THEN auth.uid() ELSE processed_by END,
        processed_at = CASE WHEN p_status IN ('sent','failed','cancelled') THEN now() ELSE processed_at END
    WHERE id = p_order_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    v_o.user_id, 'mobile_money',
    CASE p_status
      WHEN 'sent' THEN 'Transaction effectuée ✅'
      WHEN 'processing' THEN 'Commande en traitement 🔵'
      WHEN 'failed' THEN 'Transaction échouée 🔴'
      ELSE 'Commande annulée ⚫' END,
    v_o.operator || ' · ' || v_o.payout_amount || ' ' || v_o.payout_currency ||
      ' · commande ' || v_o.order_number ||
      CASE WHEN p_status IN ('failed','cancelled') AND NOT v_o.refunded
           THEN ' · ' || v_o.fp_price || ' FP remboursés' ELSE '' END,
    p_order_id);
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_mm_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_mm_order(uuid, text, text) TO authenticated;

-- 5. Historique des positions du classement ---------------------------------
CREATE TABLE IF NOT EXISTS public.leaderboard_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period text NOT NULL,
  position integer NOT NULL,
  distance_km numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period)
);

GRANT SELECT ON public.leaderboard_positions TO authenticated;
GRANT ALL ON public.leaderboard_positions TO service_role;
ALTER TABLE public.leaderboard_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leaderboard history readable" ON public.leaderboard_positions;
CREATE POLICY "Leaderboard history readable" ON public.leaderboard_positions
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.period_start(p_period text)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT GREATEST(
    public.current_season_start(),
    CASE p_period
      WHEN 'today' THEN date_trunc('day', now())
      WHEN 'week'  THEN date_trunc('week', now())
      WHEN 'month' THEN date_trunc('month', now())
      ELSE timestamptz '1970-01-01'
    END)
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_period text DEFAULT 'all', p_limit integer DEFAULT 100)
RETURNS TABLE(
  rank_position integer, user_id uuid, username text, avatar_url text,
  distance_km numeric, total_fp numeric, previous_position integer, delta integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT p.user_id, p.username, p.avatar_url,
           CASE WHEN p_period = 'all' THEN COALESCE(p.total_km, 0)
                ELSE COALESCE((
                  SELECT SUM(a.distance_km) FROM public.user_activities a
                  WHERE a.user_id = p.user_id
                    AND a.integrity_status <> 'fraud'
                    AND a.created_at >= public.period_start(p_period)
                ), 0) END AS dist,
           COALESCE(p.total_fp, 0) AS fp
    FROM public.profiles p
  ), ranked AS (
    SELECT b.*, ROW_NUMBER() OVER (ORDER BY b.dist DESC, b.username ASC)::int AS pos
    FROM base b
  )
  SELECT r.pos, r.user_id, r.username, r.avatar_url, ROUND(r.dist::numeric, 2), ROUND(r.fp::numeric, 2),
         lp.position,
         CASE WHEN lp.position IS NULL THEN NULL ELSE (lp.position - r.pos) END
  FROM ranked r
  LEFT JOIN public.leaderboard_positions lp
    ON lp.user_id = r.user_id AND lp.period = p_period
  ORDER BY r.pos
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO authenticated;

-- Enregistre un instantané des positions (au plus une fois toutes les 12 h)
CREATE OR REPLACE FUNCTION public.snapshot_leaderboard(p_period text DEFAULT 'all')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_last timestamptz;
BEGIN
  SELECT MAX(recorded_at) INTO v_last FROM public.leaderboard_positions WHERE period = p_period;
  IF v_last IS NOT NULL AND v_last > now() - interval '12 hours' THEN RETURN; END IF;

  INSERT INTO public.leaderboard_positions (user_id, period, position, distance_km, recorded_at)
  SELECT g.user_id, p_period, g.rank_position, g.distance_km, now()
  FROM public.get_leaderboard(p_period, 100000) g
  ON CONFLICT (user_id, period)
  DO UPDATE SET position = EXCLUDED.position,
                distance_km = EXCLUDED.distance_km,
                recorded_at = EXCLUDED.recorded_at;
END; $$;

REVOKE ALL ON FUNCTION public.snapshot_leaderboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_leaderboard(text) TO authenticated;