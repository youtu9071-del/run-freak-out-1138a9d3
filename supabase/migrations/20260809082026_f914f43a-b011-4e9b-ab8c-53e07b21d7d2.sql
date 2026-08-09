CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
  v_avatar text;
  v_base text;
  v_try int := 0;
  v_is_oauth boolean;
BEGIN
  v_is_oauth := (NEW.raw_user_meta_data->>'username') IS NULL;

  v_username := btrim(COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    'Runner' || substr(NEW.id::text, 1, 4)
  ));
  IF v_username = '' THEN
    v_username := 'Runner' || substr(NEW.id::text, 1, 4);
  END IF;

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) THEN
    IF NOT v_is_oauth THEN
      RAISE EXCEPTION 'USERNAME_TAKEN';
    END IF;
    v_base := v_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) AND v_try < 50 LOOP
      v_try := v_try + 1;
      v_username := v_base || v_try::text;
    END LOOP;
  END IF;

  INSERT INTO public.profiles (user_id, username, avatar_url)
  VALUES (NEW.id, v_username, v_avatar);
  RETURN NEW;
END;
$$;