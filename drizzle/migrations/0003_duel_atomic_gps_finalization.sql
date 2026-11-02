ALTER TABLE public.duel_participations ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.user_activities(id), ADD COLUMN IF NOT EXISTS threshold_reached_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS duel_activity_unique ON public.duel_participations(activity_id) WHERE activity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.duel_gps_result(p_points jsonb, p_target numeric, p_distance numeric, p_seconds integer, p_started_at numeric)
RETURNS TABLE(distance_km numeric, duration_seconds integer, threshold_ms numeric)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE pt jsonb; prev jsonb; lat1 double precision; lat2 double precision; dl double precision; dn double precision; h double precision; seg numeric; dt numeric; cumulative numeric := 0; stamp numeric; prev_stamp numeric; counted boolean;
BEGIN
 distance_km := GREATEST(COALESCE(p_distance,0),0); duration_seconds := GREATEST(COALESCE(p_seconds,0),0); threshold_ms := NULL;
 IF p_target <= 0 OR jsonb_typeof(p_points) <> 'array' THEN RETURN NEXT; RETURN; END IF;
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
   IF cumulative + seg >= p_target AND seg > 0 AND p_distance >= p_target THEN
    threshold_ms := prev_stamp + (stamp-prev_stamp)*(p_target-cumulative)/seg;
    distance_km := p_target;
    duration_seconds := LEAST(GREATEST(p_seconds,0),GREATEST(0,round((threshold_ms-p_started_at)/1000)::integer));
    RETURN NEXT; RETURN;
   END IF;
   cumulative := cumulative + seg;
  END IF;
  prev := pt; prev_stamp := stamp;
 END LOOP;
 -- Missing legacy GPS evidence must never invent a proportional threshold time.
 IF distance_km >= p_target THEN distance_km := p_target; END IF;
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.duel_gps_result(jsonb,numeric,numeric,integer,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duel_gps_result(jsonb,numeric,numeric,integer,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalize_duel_activity(p_invite_id uuid, p_activity_id uuid, p_started_at numeric, p_run jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.challenge_invites%ROWTYPE; part public.duel_participations%ROWTYPE; run public.user_activities%ROWTYPE; metrics RECORD; start_ms numeric; valid_distance numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO v FROM public.challenge_invites WHERE id=p_invite_id FOR UPDATE;
 IF v.id IS NULL OR auth.uid() NOT IN (v.challenger_id,v.challenged_id) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
 SELECT * INTO part FROM public.duel_participations WHERE invite_id=p_invite_id AND user_id=auth.uid() FOR UPDATE;
 IF part.id IS NULL THEN RAISE EXCEPTION 'NO_ATTEMPT'; END IF;
 IF part.attempt_status='finished' THEN RETURN; END IF;
 IF p_activity_id IS NULL OR (p_run->>'distance_km')::numeric < 0 OR (p_run->>'duration_seconds')::integer < 0 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 INSERT INTO public.user_activities(id,user_id,distance_km,steps,duration_seconds,avg_speed,calories,fp_from_km,fp_from_steps,total_fp,integrity_status,gps_points)
 VALUES(p_activity_id,auth.uid(),(p_run->>'distance_km')::numeric,(p_run->>'steps')::integer,(p_run->>'duration_seconds')::integer,(p_run->>'avg_speed')::numeric,(p_run->>'calories')::integer,(p_run->>'fp_from_km')::numeric,(p_run->>'fp_from_steps')::numeric,(p_run->>'total_fp')::numeric,(p_run->>'integrity_status')::public.integrity_status,p_run->'gps_points') ON CONFLICT(id) DO NOTHING;
 SELECT * INTO run FROM public.user_activities WHERE id=p_activity_id;
 IF run.user_id <> auth.uid() OR EXISTS(SELECT 1 FROM public.duel_participations WHERE activity_id=p_activity_id AND id<>part.id) THEN RAISE EXCEPTION 'INVALID_ACTIVITY'; END IF;
 start_ms := GREATEST(COALESCE(p_started_at,extract(epoch FROM part.started_at)*1000),COALESCE(extract(epoch FROM part.started_at)*1000,0));
 valid_distance := CASE WHEN run.integrity_status='clean' THEN run.distance_km ELSE 0 END;
 SELECT * INTO metrics FROM public.duel_gps_result(run.gps_points,v.distance_km,valid_distance,run.duration_seconds,start_ms);
 UPDATE public.duel_participations SET distance_km=metrics.distance_km, duration_seconds=metrics.duration_seconds, completed=metrics.distance_km>=v.distance_km, attempt_status='finished',finished_at=now(), activity_id=p_activity_id, threshold_reached_at=CASE WHEN metrics.threshold_ms IS NULL THEN NULL ELSE to_timestamp(metrics.threshold_ms/1000) END WHERE id=part.id;
 -- A late offline upload can finish the attempt but cannot reopen an already settled duel.
 IF v.status::text='accepted' THEN PERFORM public.resolve_duel(p_invite_id,false); END IF;
END $$;
REVOKE ALL ON FUNCTION public.finalize_duel_activity(uuid,uuid,numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_duel_activity(uuid,uuid,numeric,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_duel_run(p_invite_id uuid,p_distance_km numeric,p_duration_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.challenge_invites%ROWTYPE; p public.duel_participations%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth requise'; END IF;
 SELECT * INTO v FROM public.challenge_invites WHERE id=p_invite_id FOR UPDATE;
 IF v.id IS NULL OR auth.uid() NOT IN(v.challenger_id,v.challenged_id) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
 SELECT * INTO p FROM public.duel_participations WHERE invite_id=p_invite_id AND user_id=auth.uid() FOR UPDATE;
 IF p.attempt_status='finished' THEN RETURN; END IF;
 IF v.status::text<>'accepted' THEN RAISE EXCEPTION 'Défi non actif'; END IF;
 IF v.duel_ends_at IS NOT NULL AND v.duel_ends_at<now() THEN RAISE EXCEPTION 'Défi expiré'; END IF;
 IF p.id IS NULL OR p.attempt_status<>'in_progress' THEN RAISE EXCEPTION 'Aucune tentative en cours'; END IF;
 UPDATE public.duel_participations SET distance_km=LEAST(v.distance_km,GREATEST(COALESCE(p_distance_km,0),0)),duration_seconds=GREATEST(COALESCE(p_duration_seconds,0),0),completed=COALESCE(p_distance_km,0)>=v.distance_km,attempt_status='finished',finished_at=now() WHERE id=p.id;
 PERFORM public.resolve_duel(p_invite_id,false);
END $$;
REVOKE ALL ON FUNCTION public.submit_duel_run(uuid,numeric,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_duel_run(uuid,numeric,integer) TO authenticated,service_role;