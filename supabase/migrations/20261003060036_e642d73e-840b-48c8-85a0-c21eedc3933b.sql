CREATE OR REPLACE FUNCTION public.snapshot_leaderboard(p_period text DEFAULT 'all')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_last timestamptz;
BEGIN
  SELECT MAX(recorded_at) INTO v_last FROM public.leaderboard_positions WHERE period = p_period;
  IF v_last IS NOT NULL AND v_last > now() - interval '12 hours' THEN RETURN; END IF;

  IF p_period = 'all' AND v_last IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT g.user_id,
           CASE WHEN g.rank_position > lp.position THEN 'rank_lost' ELSE 'rank_gained' END,
           CASE WHEN g.rank_position > lp.position THEN '⚡ TU VIENS D''ÊTRE DÉPASSÉ' ELSE '🔥 TU VIENS DE LE DÉPASSER' END,
           CASE WHEN g.rank_position > lp.position
                THEN 'Tu passes de la #' || lp.position || ' à la #' || g.rank_position || 'e place. Reprends ta place !'
                ELSE 'Tu prends maintenant la #' || g.rank_position || 'e place.' END
    FROM public.get_leaderboard('all', 100000) g
    JOIN public.leaderboard_positions lp ON lp.user_id = g.user_id AND lp.period = 'all'
    WHERE lp.position <> g.rank_position;
  END IF;

  INSERT INTO public.leaderboard_positions (user_id, period, position, distance_km, recorded_at)
  SELECT g.user_id, p_period, g.rank_position, g.distance_km, now()
  FROM public.get_leaderboard(p_period, 100000) g
  ON CONFLICT (user_id, period)
  DO UPDATE SET position = EXCLUDED.position,
                distance_km = EXCLUDED.distance_km,
                recorded_at = EXCLUDED.recorded_at;
END; $$;

REVOKE ALL ON FUNCTION public.snapshot_leaderboard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_leaderboard(text) TO authenticated;