DROP POLICY IF EXISTS "Admin can delete QR codes" ON public.purchase_qrcodes;
CREATE POLICY "Admin can delete QR codes"
ON public.purchase_qrcodes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));