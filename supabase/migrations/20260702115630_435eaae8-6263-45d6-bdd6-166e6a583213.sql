
-- 1. Preserve event participation history: snapshot event fields, and detach on delete instead of cascading
ALTER TABLE public.event_participants
  ADD COLUMN IF NOT EXISTS event_title TEXT,
  ADD COLUMN IF NOT EXISTS event_distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS event_reward_fp NUMERIC;

ALTER TABLE public.event_participants DROP CONSTRAINT IF EXISTS event_participants_event_id_fkey;
ALTER TABLE public.event_participants ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE public.event_participants
  ADD CONSTRAINT event_participants_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

-- Snapshot event data when someone joins
CREATE OR REPLACE FUNCTION public.snapshot_event_on_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND (NEW.event_title IS NULL) THEN
    SELECT title, distance_km, reward_fp
      INTO NEW.event_title, NEW.event_distance_km, NEW.event_reward_fp
      FROM public.events WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_snapshot_event_on_join ON public.event_participants;
CREATE TRIGGER trg_snapshot_event_on_join
  BEFORE INSERT ON public.event_participants
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_event_on_join();

-- 2. Auto-expire + hard-delete events past their end_date + 48h
CREATE OR REPLACE FUNCTION public.cleanup_expired_events()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Mark ended events as completed
  UPDATE public.events
     SET status = 'completed'
   WHERE end_date < now() AND status <> 'completed';

  -- Snapshot participation history for events about to be deleted
  UPDATE public.event_participants ep
     SET event_title       = COALESCE(ep.event_title, e.title),
         event_distance_km = COALESCE(ep.event_distance_km, e.distance_km),
         event_reward_fp   = COALESCE(ep.event_reward_fp, e.reward_fp)
    FROM public.events e
   WHERE ep.event_id = e.id
     AND e.status = 'completed'
     AND e.end_date < (now() - interval '48 hours');

  -- Delete events past 48h (participation rows keep event_id = NULL + snapshot)
  DELETE FROM public.events
   WHERE status = 'completed' AND end_date < (now() - interval '48 hours');
END; $$;

-- 3. Restrict team creation to GUERRIER DES PAVÉS III+ (>= 101 km) - enforced server-side
CREATE OR REPLACE FUNCTION public.enforce_team_creation_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_km NUMERIC;
BEGIN
  SELECT COALESCE(total_km, 0) INTO v_km FROM public.profiles WHERE user_id = NEW.creator_id;
  IF COALESCE(v_km, 0) < 101 THEN
    RAISE EXCEPTION 'TEAM_LEVEL_REQUIRED: Il faut atteindre le rang GUERRIER DES PAVÉS III (101 km) pour créer une équipe';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_team_creation_level ON public.teams;
CREATE TRIGGER trg_enforce_team_creation_level
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_creation_level();

-- 4. Realtime for events
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
