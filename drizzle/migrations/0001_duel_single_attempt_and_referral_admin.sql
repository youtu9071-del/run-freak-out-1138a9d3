ALTER TYPE public.challenge_invite_status ADD VALUE IF NOT EXISTS 'completed';

-- ===== DUELS : tentative unique =====
ALTER TABLE public.duel_participations ADD COLUMN IF NOT EXISTS attempt_status text NOT NULL DEFAULT 'finished';
ALTER TABLE public.duel_participations ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.duel_participations ADD COLUMN IF NOT EXISTS finished_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS duel_participations_one_attempt ON public.duel_participations(invite_id, user_id);

CREATE OR REPLACE FUNCTION public.resolve_duel(p_invite_id uuid, p_force boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; a RECORD; b RECORD;
  a_done boolean; b_done boolean; a_ok boolean; b_ok boolean;
  v_winner uuid; v_payout numeric;
BEGIN
  SELECT * INTO v FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v.id IS NULL OR v.status::text <> 'accepted' THEN RETURN; END IF;
  SELECT * INTO a FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = v.challenger_id;
  SELECT * INTO b FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = v.challenged_id;
  a_done := a.id IS NOT NULL AND a.attempt_status = 'finished';
  b_done := b.id IS NOT NULL AND b.attempt_status = 'finished';
  IF NOT p_force AND NOT (a_done AND b_done) THEN RETURN; END IF;
  a_ok := a_done AND a.distance_km >= v.distance_km;
  b_ok := b_done AND b.distance_km >= v.distance_km;

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
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_duel(uuid, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finalize_duel_auto(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD;
BEGIN
  SELECT * INTO v FROM public.challenge_invites WHERE id = p_invite_id;
  IF v.id IS NULL OR v.status::text <> 'accepted' THEN RETURN; END IF;
  IF v.duel_ends_at IS NULL OR v.duel_ends_at > now() THEN RETURN; END IF;
  PERFORM public.resolve_duel(p_invite_id, true);
END $$;

CREATE OR REPLACE FUNCTION public.start_duel_attempt(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth requise'; END IF;
  SELECT * INTO v FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF v.status::text <> 'accepted' THEN RAISE EXCEPTION 'Défi non actif'; END IF;
  IF auth.uid() NOT IN (v.challenger_id, v.challenged_id) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF v.duel_ends_at IS NOT NULL AND v.duel_ends_at < now() THEN RAISE EXCEPTION 'Défi expiré'; END IF;
  IF EXISTS (SELECT 1 FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Tentative déjà utilisée pour ce défi';
  END IF;
  INSERT INTO public.duel_participations (invite_id, user_id, distance_km, duration_seconds, completed, attempt_status, started_at)
  VALUES (p_invite_id, auth.uid(), 0, 0, false, 'in_progress', now());
END $$;
REVOKE EXECUTE ON FUNCTION public.start_duel_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_duel_attempt(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_duel_run(p_invite_id uuid, p_distance_km numeric, p_duration_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; p RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth requise'; END IF;
  SELECT * INTO v FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF v.status::text <> 'accepted' THEN RAISE EXCEPTION 'Défi non actif'; END IF;
  IF auth.uid() NOT IN (v.challenger_id, v.challenged_id) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF v.duel_ends_at IS NOT NULL AND v.duel_ends_at < now() THEN RAISE EXCEPTION 'Défi expiré'; END IF;
  SELECT * INTO p FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = auth.uid() FOR UPDATE;
  IF p.id IS NULL OR p.attempt_status <> 'in_progress' THEN RAISE EXCEPTION 'Aucune tentative en cours'; END IF;
  UPDATE public.duel_participations SET
    distance_km = GREATEST(COALESCE(p_distance_km,0),0),
    duration_seconds = GREATEST(COALESCE(p_duration_seconds,0),0),
    completed = COALESCE(p_distance_km,0) >= v.distance_km,
    attempt_status = 'finished', finished_at = now()
  WHERE id = p.id;
  PERFORM public.resolve_duel(p_invite_id, false);
END $$;

-- ===== PARRAINAGE : réglage global =====
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  disabled_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.app_settings(key, enabled, enabled_at) VALUES ('referral', true, now());

CREATE OR REPLACE FUNCTION public.referral_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.app_settings WHERE key = 'referral'), false)
$$;

CREATE OR REPLACE FUNCTION public.admin_set_referral_enabled(p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.app_settings SET enabled = p_enabled,
    enabled_at = CASE WHEN p_enabled THEN now() ELSE enabled_at END,
    disabled_at = CASE WHEN NOT p_enabled THEN now() ELSE disabled_at END,
    updated_by = auth.uid(), updated_at = now()
  WHERE key = 'referral';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_referral_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_enabled(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_referral_list()
RETURNS TABLE(id uuid, referrer_username text, referee_username text, rewarded boolean, reward_fp numeric, rewarded_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  RETURN QUERY SELECT r.id, pr.username, pe.username, r.rewarded, r.reward_fp, r.rewarded_at, r.created_at
  FROM public.referrals r
  LEFT JOIN public.profiles pr ON pr.user_id = r.referrer_id
  LEFT JOIN public.profiles pe ON pe.user_id = r.referee_id
  ORDER BY r.created_at DESC LIMIT 1000;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_referral_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referral_list() TO authenticated;

-- Parrainage uniquement à l'inscription
CREATE OR REPLACE FUNCTION public.set_referrer(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'SIGNUP_ONLY'; END $$;

CREATE OR REPLACE FUNCTION public.apply_referral_reward(p_referee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referrals%ROWTYPE; v_km numeric;
BEGIN
  IF NOT public.referral_enabled() THEN RETURN; END IF;
  SELECT * INTO r FROM public.referrals WHERE referee_id = p_referee AND rewarded = false FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(distance_km),0) INTO v_km FROM public.user_activities
   WHERE user_id = p_referee AND integrity_status = 'clean';
  IF v_km < 5 THEN RETURN; END IF;
  UPDATE public.referrals SET rewarded = true, reward_fp = 2, rewarded_at = now() WHERE id = r.id;
  UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + 2, updated_at = now() WHERE user_id = r.referrer_id;
  INSERT INTO public.notifications(user_id,type,title,message,related_id)
  VALUES (r.referrer_id,'referral','🎁 +2 FP de parrainage','Ton filleul a validé 5 km de course.', r.id);
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_username text; v_avatar text; v_base text; v_try int := 0; v_is_oauth boolean;
  v_ref_name text; v_ref uuid;
BEGIN
  v_is_oauth := (NEW.raw_user_meta_data->>'username') IS NULL;
  v_username := btrim(COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name', 'Runner' || substr(NEW.id::text, 1, 4)));
  IF v_username = '' THEN v_username := 'Runner' || substr(NEW.id::text, 1, 4); END IF;
  v_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture');
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) THEN
    IF NOT v_is_oauth THEN RAISE EXCEPTION 'USERNAME_TAKEN'; END IF;
    v_base := v_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) AND v_try < 50 LOOP
      v_try := v_try + 1; v_username := v_base || v_try::text;
    END LOOP;
  END IF;
  INSERT INTO public.profiles (user_id, username, avatar_url) VALUES (NEW.id, v_username, v_avatar);

  v_ref_name := btrim(COALESCE(NEW.raw_user_meta_data->>'referrer_username', ''));
  IF v_ref_name <> '' AND public.referral_enabled() THEN
    SELECT user_id INTO v_ref FROM public.profiles WHERE lower(username) = lower(v_ref_name) AND user_id <> NEW.id LIMIT 1;
    IF v_ref IS NOT NULL THEN
      INSERT INTO public.referrals(referrer_id, referee_id) VALUES (v_ref, NEW.id) ON CONFLICT (referee_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;