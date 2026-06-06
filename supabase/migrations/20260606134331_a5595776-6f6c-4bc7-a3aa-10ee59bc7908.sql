CREATE OR REPLACE FUNCTION public.partner_scan_validate(p_uid text)
RETURNS TABLE(status text, already_used boolean, used_at timestamp with time zone, expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.purchase_qrcodes%ROWTYPE;
  v_updated public.purchase_qrcodes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.purchase_qrcodes WHERE qr_uid = p_uid;
  IF v_row.id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, false, NULL::timestamp with time zone, false;
    RETURN;
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() AND v_row.status = 'active' THEN
    UPDATE public.purchase_qrcodes SET status = 'expired' WHERE id = v_row.id;
    RETURN QUERY SELECT 'expired'::text, false, NULL::timestamp with time zone, true;
    RETURN;
  END IF;

  -- Atomic single-use: only succeeds if still active
  UPDATE public.purchase_qrcodes
     SET status = 'used', used_at = now()
   WHERE id = v_row.id AND status = 'active'
   RETURNING * INTO v_updated;

  IF v_updated.id IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, false, v_updated.used_at, false;
  ELSE
    RETURN QUERY SELECT v_row.status, true, v_row.used_at, false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.partner_scan_validate(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scan_qrcode_lookup(text) TO anon, authenticated, service_role;