UPDATE public.user_activities
SET fp_from_km = ROUND((distance_km / 10 * 5)::numeric, 2),
    fp_from_steps = 0,
    total_fp = CASE WHEN integrity_status = 'fraud' THEN 0 ELSE ROUND((distance_km / 10 * 5)::numeric, 2) END
WHERE user_id = 'fe9e3949-8ee9-4639-b655-abfeea19ad74';

SELECT public.update_profile_stats('fe9e3949-8ee9-4639-b655-abfeea19ad74'::uuid);