
-- Add currency column to products
ALTER TABLE public.products ADD COLUMN currency text NOT NULL DEFAULT 'EUR';

-- Add date columns and max_members to challenges
ALTER TABLE public.challenges ADD COLUMN start_date timestamp with time zone DEFAULT now();
ALTER TABLE public.challenges ADD COLUMN end_date timestamp with time zone;
ALTER TABLE public.challenges ADD COLUMN max_members integer DEFAULT 5;

-- Create product-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policies for product images
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
