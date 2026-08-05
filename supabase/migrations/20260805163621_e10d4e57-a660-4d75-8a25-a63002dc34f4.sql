
CREATE OR REPLACE FUNCTION public.sync_event_progress(p_distance_km numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  r RECORD;
  v_new numeric;
BEGIN
  IF v_user IS NULL OR COALESCE(p_distance_km, 0) <= 0 THEN RETURN; END IF;

  FOR r IN
    SELECT ep.id, ep.distance_completed, e.distance_km, e.reward_fp
      FROM public.event_participants ep
      JOIN public.events e ON e.id = ep.event_id
     WHERE ep.user_id = v_user
       AND ep.completed = false
       AND e.start_date <= now()
       AND e.end_date >= now()
  LOOP
    v_new := COALESCE(r.distance_completed, 0) + p_distance_km;

    IF v_new >= r.distance_km THEN
      UPDATE public.event_participants
         SET distance_completed = v_new,
             completed = true,
             completed_at = now(),
             fp_earned = r.reward_fp
       WHERE id = r.id;

      UPDATE public.profiles
         SET total_fp = COALESCE(total_fp, 0) + r.reward_fp, updated_at = now()
       WHERE user_id = v_user;

      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (v_user, 'event_completed', 'Événement complété 🎉',
              'Tu as terminé l''événement ! +' || r.reward_fp || ' FP', r.id);
    ELSE
      UPDATE public.event_participants
         SET distance_completed = v_new
       WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_event_progress(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_event_progress(numeric) TO authenticated, service_role;

-- Un seul enregistrement par utilisateur et par événement (anti multi-appareils)
CREATE UNIQUE INDEX IF NOT EXISTS event_participants_unique_user_event
  ON public.event_participants (event_id, user_id);
