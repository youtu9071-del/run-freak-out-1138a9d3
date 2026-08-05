CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(btrim(p_username))
      AND (auth.uid() IS NULL OR user_id <> auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := btrim(COALESCE(NEW.raw_user_meta_data->>'username', 'Runner' || substr(NEW.id::text, 1, 4)));

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) THEN
    RAISE EXCEPTION 'USERNAME_TAKEN';
  END IF;

  INSERT INTO public.profiles (user_id, username) VALUES (NEW.id, v_username);
  RETURN NEW;
END;
$$;

-- Recalcul automatique des stats du profil après chaque activité
CREATE OR REPLACE FUNCTION public.sync_profile_stats_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_profile_stats(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_stats ON public.user_activities;
CREATE TRIGGER trg_sync_profile_stats
AFTER INSERT OR UPDATE OR DELETE ON public.user_activities
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_stats_on_activity();

-- Resynchronise tous les profils existants
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles LOOP
    PERFORM public.update_profile_stats(r.user_id);
  END LOOP;
END $$;