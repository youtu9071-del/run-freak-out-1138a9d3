-- Add missing FK between purchase_qrcodes and products so PostgREST can join them
ALTER TABLE public.purchase_qrcodes
  ADD CONSTRAINT purchase_qrcodes_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Create the missing expire_old_qrcodes function (auto-expires QR codes past expires_at)
CREATE OR REPLACE FUNCTION public.expire_old_qrcodes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.purchase_qrcodes
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
END;
$$;