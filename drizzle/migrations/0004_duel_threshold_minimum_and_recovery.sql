CREATE OR REPLACE FUNCTION public.duel_gps_result(p_points jsonb, p_target numeric, p_distance numeric, p_seconds integer, p_started_at numeric)
RETURNS TABLE(distance_km numeric, duration_seconds integer, threshold_ms numeric)
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE pt jsonb; prev jsonb; lat1 double precision; lat2 double precision; dl double precision; dn double precision; h double precision; seg numeric; dt numeric; cumulative numeric := 0; stamp numeric; prev_stamp numeric; counted boolean;
BEGIN
 distance_km := GREATEST(COALESCE(p_distance,0),0); duration_seconds := GREATEST(COALESCE(p_seconds,0),0); threshold_ms := NULL;
 IF COALESCE(p_target,0) <= 0 THEN RETURN NEXT; RETURN; END IF;
 IF p_points IS NOT NULL AND jsonb_typeof(p_points) = 'array' THEN
  FOR pt IN SELECT value FROM jsonb_array_elements(p_points) LOOP
   IF NOT (pt ? 'lat' AND pt ? 'lng' AND pt ? 'timestamp') THEN CONTINUE; END IF;
   stamp := (pt->>'timestamp')::numeric;
   IF prev IS NULL THEN prev := pt; prev_stamp := stamp; CONTINUE; END IF;
   dt := (stamp-prev_stamp)/1000;
   IF dt <= 0 THEN CONTINUE; END IF;
   lat1 := radians((prev->>'lat')::double precision); lat2 := radians((pt->>'lat')::double precision);
   dl := lat2-lat1; dn := radians((pt->>'lng')::double precision-(prev->>'lng')::double precision);
   h := power(sin(dl/2),2) + cos(lat1)*cos(lat2)*power(sin(dn/2),2);
   seg := 6371 * 2 * asin(sqrt(LEAST(1.0,GREATEST(0.0,h))));
   counted := CASE WHEN pt ? 'duelCounted' THEN (pt->>'duelCounted')::boolean ELSE true END;
   IF counted AND seg/dt*3600 <= 45 AND NOT (seg > 0.25 AND dt < 15) THEN
    -- Threshold is a MINIMUM: the first validated segment that reaches it freezes the duel result.
    IF cumulative + seg >= p_target AND seg > 0 THEN
     threshold_ms := prev_stamp + (stamp-prev_stamp)*(p_target-cumulative)/seg;
     distance_km := p_target;
     duration_seconds := LEAST(GREATEST(COALESCE(p_seconds,0),0), GREATEST(0, round((threshold_ms-p_started_at)/1000)::integer));
     RETURN NEXT; RETURN;
    END IF;
    cumulative := cumulative + seg;
   END IF;
   prev := pt; prev_stamp := stamp;
  END LOOP;
 END IF;
 -- Validated distance reached the minimum but GPS evidence is too sparse to interpolate:
 -- the participant is qualified, capped at the threshold, with the real time (never invented).
 IF distance_km >= p_target THEN distance_km := p_target; END IF;
 RETURN NEXT;
END $function$;

-- Links a validated run recorded during an open attempt that never reached the duel (lost context, app killed).
CREATE OR REPLACE FUNCTION public.recover_duel_attempt(p_invite_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.challenge_invites%ROWTYPE; part public.duel_participations%ROWTYPE; run public.user_activities%ROWTYPE; metrics RECORD; start_ms numeric; last_ms numeric;
BEGIN
 SELECT * INTO v FROM public.challenge_invites WHERE id=p_invite_id;
 SELECT * INTO part FROM public.duel_participations WHERE invite_id=p_invite_id AND user_id=p_user_id FOR UPDATE;
 IF v.id IS NULL OR part.id IS NULL OR part.attempt_status<>'in_progress' OR part.started_at IS NULL THEN RETURN false; END IF;
 SELECT ua.* INTO run FROM public.user_activities ua
  WHERE ua.user_id=p_user_id AND ua.integrity_status='clean' AND ua.distance_km > 0
    AND jsonb_typeof(ua.gps_points)='array' AND jsonb_array_length(ua.gps_points) > 0
    AND (ua.gps_points->0->>'timestamp')::numeric >= extract(epoch FROM part.started_at)*1000 - 60000
    AND (v.duel_ends_at IS NULL OR (ua.gps_points->0->>'timestamp')::numeric <= extract(epoch FROM v.duel_ends_at)*1000)
    AND NOT EXISTS (SELECT 1 FROM public.duel_participations x WHERE x.activity_id=ua.id)
  ORDER BY (ua.gps_points->0->>'timestamp')::numeric ASC LIMIT 1;
 IF run.id IS NULL THEN RETURN false; END IF;
 last_ms := (run.gps_points->-1->>'timestamp')::numeric;
 start_ms := GREATEST(extract(epoch FROM part.started_at)*1000, last_ms - run.duration_seconds*1000::numeric);
 SELECT * INTO metrics FROM public.duel_gps_result(run.gps_points, v.distance_km, run.distance_km, run.duration_seconds, start_ms);
 UPDATE public.duel_participations SET distance_km=metrics.distance_km, duration_seconds=metrics.duration_seconds,
   completed=metrics.distance_km>=v.distance_km, attempt_status='finished', finished_at=now(), activity_id=run.id,
   threshold_reached_at=CASE WHEN metrics.threshold_ms IS NULL THEN NULL ELSE to_timestamp(metrics.threshold_ms/1000) END
 WHERE id=part.id;
 RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.recover_duel_attempt(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_duel(p_invite_id uuid, p_force boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v RECORD; a RECORD; b RECORD;
  a_done boolean; b_done boolean; a_ok boolean; b_ok boolean;
  v_winner uuid; v_payout numeric;
BEGIN
  SELECT * INTO v FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v.id IS NULL OR v.status::text <> 'accepted' THEN RETURN; END IF;
  PERFORM public.recover_duel_attempt(p_invite_id, v.challenger_id);
  PERFORM public.recover_duel_attempt(p_invite_id, v.challenged_id);
  SELECT * INTO a FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = v.challenger_id;
  SELECT * INTO b FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = v.challenged_id;
  a_done := a.id IS NOT NULL AND a.attempt_status = 'finished';
  b_done := b.id IS NOT NULL AND b.attempt_status = 'finished';
  IF NOT p_force AND NOT (a_done AND b_done) THEN RETURN; END IF;
  -- Minimum threshold: unrounded numeric comparison, overshoot always qualifies.
  a_ok := a_done AND (COALESCE(a.completed,false) OR COALESCE(a.distance_km,0) >= v.distance_km);
  b_ok := b_done AND (COALESCE(b.completed,false) OR COALESCE(b.distance_km,0) >= v.distance_km);

  IF a_ok AND b_ok THEN
    IF a.duration_seconds < b.duration_seconds THEN v_winner := v.challenger_id;
    ELSIF b.duration_seconds < a.duration_seconds THEN v_winner := v.challenged_id; END IF;
  ELSIF a_ok THEN v_winner := v.challenger_id;
  ELSIF b_ok THEN v_winner := v.challenged_id;
  END IF;

  IF v_winner IS NULL THEN
    UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v.stake_fp, updated_at = now()
      WHERE user_id IN (v.challenger_id, v.challenged_id);
    UPDATE public.challenge_invites SET status = 'completed', winner_id = NULL, winner_reward = 0, completed_at = now()
      WHERE id = p_invite_id;
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT u, 'duel_tie', 'Défi terminé — aucun gagnant',
      CASE WHEN a_ok AND b_ok THEN 'Temps identiques. ' ELSE 'Aucun participant n''a atteint la distance requise. ' END
      || 'Tes ' || v.stake_fp || ' FP te sont restitués.', p_invite_id
    FROM unnest(ARRAY[v.challenger_id, v.challenged_id]) AS u;
    RETURN;
  END IF;

  v_payout := GREATEST(COALESCE(v.coffre_amount,0) - COALESCE(v.coffre_fee,0), 0);
  UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_payout, updated_at = now() WHERE user_id = v_winner;
  UPDATE public.challenge_invites SET status = 'completed', winner_id = v_winner, winner_reward = v_payout, completed_at = now()
    WHERE id = p_invite_id;
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (v_winner, 'duel_won', '🏆 Défi remporté !', 'Coffre ouvert ! +' || v_payout || ' FP', p_invite_id),
         (CASE WHEN v_winner = v.challenger_id THEN v.challenged_id ELSE v.challenger_id END,
          'duel_lost', 'Duel terminé', 'Ton adversaire a remporté le coffre.', p_invite_id);
END $function$;

-- A normal run saved while an attempt is open is linked immediately (not only at expiry).
CREATE OR REPLACE FUNCTION public.duel_link_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
 IF NEW.integrity_status IS DISTINCT FROM 'clean' THEN RETURN NEW; END IF;
 FOR r IN SELECT dp.invite_id FROM public.duel_participations dp JOIN public.challenge_invites ci ON ci.id=dp.invite_id
   WHERE dp.user_id=NEW.user_id AND dp.attempt_status='in_progress' AND ci.status::text='accepted' LOOP
   PERFORM public.resolve_duel(r.invite_id, false);
 END LOOP;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.duel_link_activity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS duel_link_activity_trg ON public.user_activities;
CREATE TRIGGER duel_link_activity_trg AFTER INSERT ON public.user_activities
FOR EACH ROW EXECUTE FUNCTION public.duel_link_activity();