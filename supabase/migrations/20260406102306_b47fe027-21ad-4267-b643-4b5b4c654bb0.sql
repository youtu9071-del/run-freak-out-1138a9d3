
CREATE TABLE public.purchase_qrcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  fp_used numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  qr_data text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  used_at timestamp with time zone,
  scanned_by uuid
);

ALTER TABLE public.purchase_qrcodes ENABLE ROW LEVEL SECURITY;

-- Users can view their own QR codes
CREATE POLICY "Users can view their QR codes"
ON public.purchase_qrcodes FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Users can create QR codes
CREATE POLICY "Users can create QR codes"
ON public.purchase_qrcodes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admin can update QR codes (scan/validate)
CREATE POLICY "Admin can update QR codes"
ON public.purchase_qrcodes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can delete their own active QR codes
CREATE POLICY "Users can delete their QR codes"
ON public.purchase_qrcodes FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status = 'active');
