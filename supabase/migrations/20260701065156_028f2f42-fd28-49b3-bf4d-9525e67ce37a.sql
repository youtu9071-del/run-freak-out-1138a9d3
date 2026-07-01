
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer;

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

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id AND in_stock = true FOR UPDATE;
  IF v_product IS NULL THEN
    RAISE EXCEPTION 'Product not available';
  END IF;

  IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity <= 0 THEN
    RAISE EXCEPTION 'OUT_OF_STOCK: produit épuisé';
  END IF;

  v_fp_used := GREATEST(0, COALESCE(p_fp_to_use, 0));
  IF v_fp_used > v_product.max_fp_discount THEN
    RAISE EXCEPTION 'FP discount exceeds product max (% FP)', v_product.max_fp_discount;
  END IF;

  SELECT total_fp INTO v_user_fp FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  IF v_user_fp IS NULL THEN v_user_fp := 0; END IF;

  IF v_fp_used > v_user_fp THEN
    RAISE EXCEPTION 'INSUFFICIENT_FP: solde % FP, requis % FP', v_user_fp, v_fp_used;
  END IF;

  v_discount := LEAST(v_fp_used * COALESCE(v_product.fp_discount_rate, 0), v_product.price * 0.5);
  v_total := GREATEST(v_product.price - v_discount, 0);

  IF v_fp_used > 0 THEN
    UPDATE public.profiles SET total_fp = total_fp - v_fp_used, updated_at = now()
      WHERE user_id = v_user;
  END IF;

  -- Decrement stock if tracked
  IF v_product.stock_quantity IS NOT NULL THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity - 1,
          in_stock = CASE WHEN stock_quantity - 1 <= 0 THEN false ELSE in_stock END
      WHERE id = p_product_id;
  END IF;

  v_uid := replace(gen_random_uuid()::text, '-', '');
  v_data := v_uid;

  INSERT INTO public.purchase_qrcodes (user_id, product_id, fp_used, discount_amount, total_price, qr_data, qr_uid)
  VALUES (v_user, p_product_id, v_fp_used, v_discount, v_total, v_data, v_uid)
  RETURNING id INTO v_qr_id;

  INSERT INTO public.orders (user_id, product_id, total_price, fp_used, discount_amount)
  VALUES (v_user, p_product_id, v_total, v_fp_used, v_discount);

  RETURN QUERY SELECT v_qr_id, v_uid, v_data, v_total, v_discount, v_fp_used;
END;
$function$;
