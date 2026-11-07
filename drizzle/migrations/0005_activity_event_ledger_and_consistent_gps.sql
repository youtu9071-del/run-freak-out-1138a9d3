ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS gps_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS duel_invite_id uuid REFERENCES public.challenge_invites(id);
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS event_start_date timestamptz;
ALTER TABLE public.event_participants ADD COLUMN IF NOT EXISTS event_end_date timestamptz;
UPDATE public.event_participants p SET event_start_date=e.start_date,event_end_date=e.end_date FROM public.events e WHERE e.id=p.event_id;
CREATE TABLE public.event_activity_ledger (
 participation_id uuid NOT NULL REFERENCES public.event_participants(id),
 activity_id uuid NOT NULL REFERENCES public.user_activities(id),
 distance_km numeric NOT NULL CHECK(distance_km>=0),
 historical boolean NOT NULL DEFAULT false,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(participation_id,activity_id)
);
GRANT SELECT ON public.event_activity_ledger TO authenticated;
GRANT ALL ON public.event_activity_ledger TO service_role;
ALTER TABLE public.event_activity_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_ledger_owner_read ON public.event_activity_ledger FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.event_participants p WHERE p.id=participation_id AND p.user_id=auth.uid()));
-- Baseline prior activities without changing any historical progress or paying rewards.
INSERT INTO public.event_activity_ledger(participation_id,activity_id,distance_km,historical)
SELECT p.id,a.id,a.distance_km,true FROM public.event_participants p JOIN public.user_activities a ON a.user_id=p.user_id
WHERE a.integrity_status='clean' AND a.distance_km>0 AND a.created_at>=GREATEST(p.joined_at,p.event_start_date) AND a.created_at<p.event_end_date;
CREATE INDEX event_participants_activity_window ON public.event_participants(user_id,event_start_date,event_end_date);
CREATE INDEX user_activities_duel_link ON public.user_activities(duel_invite_id,user_id) WHERE duel_invite_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.snapshot_event_on_join() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.events%ROWTYPE;
BEGIN
 SELECT * INTO e FROM public.events WHERE id=NEW.event_id FOR UPDATE;
 IF e.id IS NULL OR e.status='completed' OR e.end_date<=now() THEN RAISE EXCEPTION 'EVENT_NOT_JOINABLE'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_participants p WHERE p.user_id=NEW.user_id AND p.event_id=NEW.event_id) THEN RAISE EXCEPTION 'ALREADY_JOINED' USING ERRCODE='23505'; END IF;
 IF e.max_participants IS NOT NULL AND (SELECT count(*) FROM public.event_participants WHERE event_id=e.id)>=e.max_participants THEN RAISE EXCEPTION 'EVENT_FULL'; END IF;
 NEW.joined_at:=now(); NEW.distance_completed:=0; NEW.completed:=false; NEW.completed_at:=NULL; NEW.fp_earned:=0;
 NEW.event_title:=e.title; NEW.event_distance_km:=e.distance_km; NEW.event_reward_fp:=e.reward_fp;
 NEW.event_start_date:=e.start_date; NEW.event_end_date:=e.end_date;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.apply_activity_to_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.event_participants%ROWTYPE; inserted integer; finish timestamptz:=NEW.created_at; start_time timestamptz:=COALESCE(NEW.started_at,NEW.created_at-make_interval(secs=>NEW.duration_seconds)); new_distance numeric;
BEGIN
 IF NEW.integrity_status IS DISTINCT FROM 'clean' OR NEW.distance_km<=0 THEN RETURN NEW; END IF;
 -- Entire run must fall inside [start,end), and start after enrollment. No partial/fictitious prorating.
 FOR p IN SELECT * FROM public.event_participants WHERE user_id=NEW.user_id AND start_time>=joined_at AND start_time>=event_start_date AND finish<event_end_date AND finish>=start_time ORDER BY id FOR UPDATE LOOP
  INSERT INTO public.event_activity_ledger(participation_id,activity_id,distance_km) VALUES(p.id,NEW.id,NEW.distance_km) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  IF inserted=0 THEN CONTINUE; END IF;
  new_distance:=COALESCE(p.distance_completed,0)+NEW.distance_km;
  UPDATE public.event_participants SET distance_completed=new_distance WHERE id=p.id;
  IF NOT p.completed AND p.event_distance_km>0 AND new_distance>=p.event_distance_km THEN
   UPDATE public.event_participants SET completed=true,completed_at=finish,fp_earned=COALESCE(p.event_reward_fp,0) WHERE id=p.id;
   UPDATE public.profiles SET total_fp=COALESCE(total_fp,0)+COALESCE(p.event_reward_fp,0),updated_at=now() WHERE user_id=NEW.user_id;
   INSERT INTO public.notifications(user_id,type,title,message,related_id) VALUES(NEW.user_id,'event_completed','Événement complété 🎉','Tu as terminé l’événement ! +'||COALESCE(p.event_reward_fp,0)||' FP',p.id);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_activity_event_ledger AFTER INSERT ON public.user_activities FOR EACH ROW EXECUTE FUNCTION public.apply_activity_to_events();
CREATE OR REPLACE FUNCTION public.sync_event_progress(p_distance_km numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RETURN; END $$;
COMMENT ON FUNCTION public.sync_event_progress(numeric) IS 'DEPRECATED: activity insertion trigger with unique activity ledger is authoritative; legacy calls intentionally do nothing.';
CREATE OR REPLACE FUNCTION public.valid_gps_point(pt jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE lat numeric; lng numeric; stamp numeric; acc numeric;
BEGIN
 IF jsonb_typeof(pt)<>'object' OR jsonb_typeof(pt->'lat')<>'number' OR jsonb_typeof(pt->'lng')<>'number' OR jsonb_typeof(pt->'timestamp')<>'number' THEN RETURN false; END IF;
 lat:=(pt->>'lat')::numeric; lng:=(pt->>'lng')::numeric; stamp:=(pt->>'timestamp')::numeric;
 acc:=COALESCE((pt->>'accuracy')::numeric,10);
 RETURN COALESCE(abs(lat)<=90 AND abs(lng)<=180 AND stamp>0 AND acc>0 AND acc<100000,false);
 EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE OR REPLACE FUNCTION public.duel_gps_result(p_points jsonb,p_target numeric,p_distance numeric,p_seconds integer,p_started_at numeric)
RETURNS TABLE(distance_km numeric,duration_seconds integer,threshold_ms numeric) LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE pt jsonb; prev jsonb; stamp numeric; prev_stamp numeric; dt numeric; h double precision; seg numeric; cumulative numeric:=0; counted boolean;
BEGIN
 distance_km:=GREATEST(COALESCE(p_distance,0),0); duration_seconds:=GREATEST(COALESCE(p_seconds,0),0); threshold_ms:=NULL;
 -- Never let rejected/fraud activity GPS qualify an otherwise invalid distance.
 IF distance_km<=0 OR COALESCE(p_target,0)<=0 THEN RETURN NEXT; RETURN; END IF;
 IF jsonb_typeof(p_points)='array' THEN
  FOR pt IN SELECT value FROM jsonb_array_elements(p_points) LOOP
   IF NOT public.valid_gps_point(pt) THEN prev:=NULL; CONTINUE; END IF;
   stamp:=(pt->>'timestamp')::numeric;
   IF prev IS NULL THEN prev:=pt; prev_stamp:=stamp; CONTINUE; END IF;
   IF stamp<=prev_stamp THEN CONTINUE; END IF;
   dt:=(stamp-prev_stamp)/1000;
   h:=power(sin(radians(((pt->>'lat')::double precision-(prev->>'lat')::double precision)/2)),2)+cos(radians((prev->>'lat')::double precision))*cos(radians((pt->>'lat')::double precision))*power(sin(radians(((pt->>'lng')::double precision-(prev->>'lng')::double precision)/2)),2);
   seg:=6371*2*asin(sqrt(LEAST(1.0,GREATEST(0.0,h))));
   counted:=COALESCE(pt->'duelCounted'='true'::jsonb,NOT(pt ? 'duelCounted'));
   IF counted AND seg/dt*3600<=45 AND COALESCE((pt->>'accuracy')::numeric,10)<=50 AND COALESCE((prev->>'accuracy')::numeric,10)<=50 THEN
    IF cumulative+seg>=p_target AND seg>0 AND stamp>=p_started_at AND prev_stamp>=p_started_at THEN
     threshold_ms:=prev_stamp+(stamp-prev_stamp)*(p_target-cumulative)/seg;
     distance_km:=p_target;
     duration_seconds:=GREATEST(0,ceil((threshold_ms-p_started_at)/1000)::integer);
     RETURN NEXT; RETURN;
    END IF;
    cumulative:=cumulative+seg;
   END IF;
   prev:=pt; prev_stamp:=stamp;
  END LOOP;
 END IF;
 -- Explicit conservative fallback: qualify validated overshoot; compare real full duration,
 -- never a fabricated proportional threshold time. threshold_ms stays NULL.
 distance_km:=LEAST(distance_km,p_target); RETURN NEXT;
END $$;
CREATE OR REPLACE FUNCTION public.validate_activity_gps() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pt jsonb; prev jsonb; seg numeric; dt numeric; h double precision; total numeric:=0; stamp numeric; last_stamp numeric:=0; impossible integer:=0;
BEGIN
 IF NEW.gps_version<2 THEN RETURN NEW; END IF;
 IF NEW.started_at IS NULL OR NEW.created_at<NEW.started_at OR NEW.created_at>now()+interval '5 minutes' OR NEW.duration_seconds<0 THEN RAISE EXCEPTION 'INVALID_ACTIVITY_TIME'; END IF;
 IF jsonb_typeof(NEW.gps_points)<>'array' THEN RAISE EXCEPTION 'GPS_TRACE_REQUIRED'; END IF;
 FOR pt IN SELECT value FROM jsonb_array_elements(NEW.gps_points) LOOP
  IF NOT public.valid_gps_point(pt) THEN prev:=NULL; CONTINUE; END IF;
  stamp:=(pt->>'timestamp')::numeric;
  IF stamp<=last_stamp THEN CONTINUE; END IF;
  IF stamp<extract(epoch FROM NEW.started_at)*1000-1000 OR stamp>extract(epoch FROM NEW.created_at)*1000+1000 THEN RAISE EXCEPTION 'GPS_OUTSIDE_RUN'; END IF;
  last_stamp:=stamp;
  IF prev IS NOT NULL AND pt->'duelCounted'='true'::jsonb THEN
   dt:=(stamp-(prev->>'timestamp')::numeric)/1000;
   h:=power(sin(radians(((pt->>'lat')::double precision-(prev->>'lat')::double precision)/2)),2)+cos(radians((prev->>'lat')::double precision))*cos(radians((pt->>'lat')::double precision))*power(sin(radians(((pt->>'lng')::double precision-(prev->>'lng')::double precision)/2)),2);
   seg:=6371*2*asin(sqrt(LEAST(1.0,GREATEST(0.0,h))));
   IF dt>0 AND dt<=30 AND seg/dt*3600<=45 AND COALESCE((pt->>'accuracy')::numeric,999)<=50 AND COALESCE((prev->>'accuracy')::numeric,999)<=50 THEN total:=total+seg;
   ELSE impossible:=impossible+1; END IF;
  END IF;
  prev:=pt;
 END LOOP;
 NEW.distance_km:=total;
 NEW.avg_speed:=CASE WHEN NEW.duration_seconds>0 THEN total/NEW.duration_seconds*3600 ELSE 0 END;
 IF impossible>=2 OR NEW.avg_speed>45 OR (NEW.steps>0 AND total>=0.5 AND NEW.steps/(total*1300)<0.05) THEN NEW.integrity_status:='fraud'; END IF;
 NEW.fp_from_steps:=0;
 NEW.fp_from_km:=round(total*0.5,2);
 NEW.total_fp:=CASE WHEN NEW.integrity_status='fraud' THEN 0 ELSE NEW.fp_from_km END;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_activity_gps BEFORE INSERT ON public.user_activities FOR EACH ROW EXECUTE FUNCTION public.validate_activity_gps();
CREATE OR REPLACE FUNCTION public.recover_duel_attempt(p_invite_id uuid,p_user_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE part public.duel_participations%ROWTYPE; v public.challenge_invites%ROWTYPE; run public.user_activities%ROWTYPE; metrics record;
BEGIN
 SELECT * INTO v FROM public.challenge_invites WHERE id=p_invite_id;
 SELECT * INTO part FROM public.duel_participations WHERE invite_id=p_invite_id AND user_id=p_user_id FOR UPDATE;
 IF part.id IS NULL OR part.attempt_status<>'in_progress' THEN RETURN false; END IF;
 -- Only explicit persisted association: an unrelated normal run must not consume a duel attempt.
 SELECT * INTO run FROM public.user_activities WHERE duel_invite_id=p_invite_id AND user_id=p_user_id AND started_at>=part.started_at AND (v.duel_ends_at IS NULL OR started_at<=v.duel_ends_at) ORDER BY started_at LIMIT 1;
 IF run.id IS NULL THEN RETURN false; END IF;
 SELECT * INTO metrics FROM public.duel_gps_result(run.gps_points,v.distance_km,CASE WHEN run.integrity_status='clean' THEN run.distance_km ELSE 0 END,run.duration_seconds,extract(epoch FROM run.started_at)*1000);
 UPDATE public.duel_participations SET distance_km=metrics.distance_km,duration_seconds=metrics.duration_seconds,completed=metrics.distance_km>=v.distance_km,attempt_status='finished',finished_at=run.created_at,activity_id=run.id,threshold_reached_at=CASE WHEN metrics.threshold_ms IS NULL THEN NULL ELSE to_timestamp(metrics.threshold_ms/1000) END WHERE id=part.id;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.finalize_duel_activity(p_invite_id uuid,p_activity_id uuid,p_started_at numeric,p_run jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.challenge_invites%ROWTYPE; part public.duel_participations%ROWTYPE; run public.user_activities%ROWTYPE; metrics record; start_time timestamptz; finish_time timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
 SELECT * INTO v FROM public.challenge_invites WHERE id=p_invite_id FOR UPDATE;
 IF v.id IS NULL OR auth.uid() NOT IN(v.challenger_id,v.challenged_id) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
 SELECT * INTO part FROM public.duel_participations WHERE invite_id=p_invite_id AND user_id=auth.uid() FOR UPDATE;
 IF part.id IS NULL THEN RAISE EXCEPTION 'NO_ATTEMPT'; END IF;
 IF part.attempt_status='finished' THEN
  IF part.activity_id IS DISTINCT FROM p_activity_id THEN RAISE EXCEPTION 'ATTEMPT_ALREADY_FINALIZED'; END IF;
  RETURN;
 END IF;
 IF p_activity_id IS NULL OR COALESCE((p_run->>'distance_km')::numeric,-1)<0 OR COALESCE((p_run->>'duration_seconds')::integer,-1)<0 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 start_time:=COALESCE((p_run->>'started_at')::timestamptz,to_timestamp(p_started_at/1000));
 finish_time:=COALESCE((p_run->>'created_at')::timestamptz,start_time+make_interval(secs=>(p_run->>'duration_seconds')::integer));
 IF start_time<part.started_at-interval '1 second' OR (v.duel_ends_at IS NOT NULL AND start_time>v.duel_ends_at) OR finish_time<start_time OR finish_time>now()+interval '5 minutes' THEN RAISE EXCEPTION 'INVALID_ATTEMPT_TIME'; END IF;
 INSERT INTO public.user_activities(id,user_id,distance_km,steps,duration_seconds,avg_speed,calories,fp_from_km,fp_from_steps,total_fp,integrity_status,gps_points,created_at,started_at,gps_version,duel_invite_id)
 VALUES(p_activity_id,auth.uid(),(p_run->>'distance_km')::numeric,COALESCE((p_run->>'steps')::integer,0),(p_run->>'duration_seconds')::integer,(p_run->>'avg_speed')::numeric,(p_run->>'calories')::integer,(p_run->>'fp_from_km')::numeric,0,(p_run->>'total_fp')::numeric,(p_run->>'integrity_status')::public.integrity_status,p_run->'gps_points',finish_time,start_time,COALESCE((p_run->>'gps_version')::integer,1),p_invite_id) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO run FROM public.user_activities WHERE id=p_activity_id;
 IF run.user_id<>auth.uid() OR run.duel_invite_id IS DISTINCT FROM p_invite_id OR EXISTS(SELECT 1 FROM public.duel_participations WHERE activity_id=p_activity_id AND id<>part.id) THEN RAISE EXCEPTION 'INVALID_ACTIVITY'; END IF;
 SELECT * INTO metrics FROM public.duel_gps_result(run.gps_points,v.distance_km,CASE WHEN run.integrity_status='clean' THEN run.distance_km ELSE 0 END,run.duration_seconds,extract(epoch FROM run.started_at)*1000);
 UPDATE public.duel_participations SET distance_km=metrics.distance_km,duration_seconds=metrics.duration_seconds,completed=metrics.distance_km>=v.distance_km,attempt_status='finished',finished_at=run.created_at,activity_id=p_activity_id,threshold_reached_at=CASE WHEN metrics.threshold_ms IS NULL THEN NULL ELSE to_timestamp(metrics.threshold_ms/1000) END WHERE id=part.id;
 IF v.status::text='accepted' THEN PERFORM public.resolve_duel(p_invite_id,false); END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_activity_to_events(),public.validate_activity_gps(),public.valid_gps_point(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.valid_gps_point(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.recover_duel_attempt(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recover_duel_attempt(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_duel_activity(uuid,uuid,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_duel_activity(uuid,uuid,numeric,jsonb) TO authenticated,service_role;