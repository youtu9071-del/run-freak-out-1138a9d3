CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  DELETE FROM public.purchase_qrcodes WHERE product_id = p_product_id;
  DELETE FROM public.orders WHERE product_id = p_product_id;
  DELETE FROM public.products WHERE id = p_product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_product(uuid) TO authenticated;