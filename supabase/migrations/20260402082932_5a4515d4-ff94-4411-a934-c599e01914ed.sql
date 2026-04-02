
CREATE OR REPLACE FUNCTION public.update_profile_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET
    total_km = COALESCE((SELECT SUM(distance_km) FROM public.user_activities WHERE user_id = p_user_id AND integrity_status != 'fraud'), 0),
    total_fp = COALESCE((SELECT SUM(total_fp) FROM public.user_activities WHERE user_id = p_user_id AND integrity_status != 'fraud'), 0),
    total_steps = COALESCE((SELECT SUM(steps) FROM public.user_activities WHERE user_id = p_user_id AND integrity_status != 'fraud'), 0),
    total_activities = COALESCE((SELECT COUNT(*) FROM public.user_activities WHERE user_id = p_user_id AND integrity_status != 'fraud'), 0),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
