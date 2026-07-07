
-- Purchase RPC: require user FP >= product's FP cost (max_fp_discount as required FP)
CREATE OR REPLACE FUNCTION public.purchase_with_fp(p_product_id uuid, p_fp_to_use numeric)
 RETURNS TABLE(qr_id uuid, qr_uid text, qr_data text, total_price numeric, discount_amount numeric, fp_used numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_product RECORD;
  v_user_fp numeric;
  v_required_fp numeric;
  v_fp_used numeric;
  v_discount numeric;
  v_total numeric;
  v_uid text;
  v_qr_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND in_stock = true FOR UPDATE;
  IF v_product IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';
  END IF;

  IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity <= 0 THEN
    RAISE EXCEPTION 'OUT_OF_STOCK';
  END IF;

  SELECT COALESCE(total_fp,0) INTO v_user_fp FROM public.profiles WHERE user_id = v_user FOR UPDATE;

  -- Required FP cost = product.max_fp_discount (source of truth in DB)
  v_required_fp := COALESCE(v_product.max_fp_discount, 0);

  IF v_user_fp < v_required_fp THEN
    RAISE EXCEPTION 'INSUFFICIENT_FP: solde % FP, requis % FP', v_user_fp, v_required_fp;
  END IF;

  v_fp_used := v_required_fp;
  v_discount := LEAST(v_fp_used * COALESCE(v_product.fp_discount_rate, 0), v_product.price);
  v_total := GREATEST(v_product.price - v_discount, 0);

  UPDATE public.profiles SET total_fp = total_fp - v_fp_used, updated_at = now()
    WHERE user_id = v_user;

  IF v_product.stock_quantity IS NOT NULL THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity - 1,
          in_stock = CASE WHEN stock_quantity - 1 <= 0 THEN false ELSE in_stock END
      WHERE id = p_product_id;
  END IF;

  v_uid := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.purchase_qrcodes (user_id, product_id, fp_used, discount_amount, total_price, qr_data, qr_uid)
  VALUES (v_user, p_product_id, v_fp_used, v_discount, v_total, v_uid, v_uid)
  RETURNING id INTO v_qr_id;

  INSERT INTO public.orders (user_id, product_id, total_price, fp_used, discount_amount)
  VALUES (v_user, p_product_id, v_total, v_fp_used, v_discount);

  RETURN QUERY SELECT v_qr_id, v_uid, v_uid, v_total, v_discount, v_fp_used;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.purchase_with_fp(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_with_fp(uuid, numeric) TO authenticated;

-- Claim partner invite
CREATE OR REPLACE FUNCTION public.claim_partner_invite(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_invite public.partner_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO v_invite FROM public.partner_invites WHERE token = p_token FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'INVALID_TOKEN'; END IF;
  IF v_invite.used_by IS NOT NULL THEN RAISE EXCEPTION 'ALREADY_USED'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'EXPIRED'; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'partner')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.partner_invites
    SET used_by = auth.uid(), used_at = now()
    WHERE id = v_invite.id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_partner_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_partner_invite(text) TO authenticated;

-- Allow partners to validate + lookup QR codes
CREATE OR REPLACE FUNCTION public.scan_qrcode_validate(p_uid text)
 RETURNS TABLE(status text, already_used boolean, used_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT; v_used_at TIMESTAMPTZ; v_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'partner')) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT q.id, q.status, q.used_at INTO v_id, v_status, v_used_at
  FROM public.purchase_qrcodes q WHERE q.qr_uid = p_uid;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT, false, NULL::TIMESTAMPTZ; RETURN;
  END IF;
  IF v_status = 'used' THEN
    RETURN QUERY SELECT 'used'::TEXT, true, v_used_at; RETURN;
  END IF;

  UPDATE public.purchase_qrcodes
    SET status = 'used', used_at = now(), scanned_by = auth.uid()
    WHERE id = v_id;

  RETURN QUERY SELECT 'used'::TEXT, false, now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.scan_qrcode_validate(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_qrcode_validate(text) TO authenticated;

-- Extend view policy so admins can see all QRs (already can); no change needed for partners since they use RPC via SECURITY DEFINER.

-- Admin can also view partner_invites via has_role — policy exists.
