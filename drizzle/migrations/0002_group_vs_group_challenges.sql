
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'waiting';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '7 days');
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS closed_at timestamptz;
UPDATE public.teams SET expires_at = COALESCE(created_at, now()) + interval '7 days';

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS team_a_name text;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS team_b_name text;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS team_a_members uuid[];
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS team_b_members uuid[];
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS is_tie boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Team members can create challenges" ON public.challenges;
DROP POLICY IF EXISTS "Team creator can invite members" ON public.team_members;

CREATE OR REPLACE FUNCTION public.validate_team_challenge_distance()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.distance_km IS NOT NULL AND (NEW.distance_km > 20 OR NEW.distance_km < 1) THEN
    RAISE EXCEPTION 'Distance de défi de groupe invalide';
  END IF;
  RETURN NEW;
END; $$;

-- Groupe actif (en attente ou en défi) d'un utilisateur
CREATE OR REPLACE FUNCTION public.user_active_group(p_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.id FROM public.team_members m JOIN public.teams t ON t.id = m.team_id
  WHERE m.user_id = p_user AND m.status = 'accepted'
    AND (t.status = 'in_challenge' OR (t.status = 'waiting' AND t.expires_at > now()))
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.user_active_group(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.create_group(p_name text, p_invitees uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_u uuid; v_n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF COALESCE(trim(p_name), '') = '' THEN RAISE EXCEPTION 'Nom du groupe requis'; END IF;
  IF public.user_active_group(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'Tu fais déjà partie d''un groupe actif';
  END IF;
  IF COALESCE(array_length(p_invitees, 1), 0) > 4 THEN
    RAISE EXCEPTION 'Un groupe contient 5 participants maximum';
  END IF;
  INSERT INTO public.teams (name, creator_id, status, expires_at)
  VALUES (trim(p_name), auth.uid(), 'waiting', now() + interval '7 days') RETURNING id INTO v_id;
  INSERT INTO public.team_members (team_id, user_id, invited_by, status) VALUES (v_id, auth.uid(), auth.uid(), 'accepted');
  IF p_invitees IS NOT NULL THEN
    FOREACH v_u IN ARRAY p_invitees LOOP
      IF v_u <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = v_id AND user_id = v_u) THEN
        INSERT INTO public.team_members (team_id, user_id, invited_by, status) VALUES (v_id, v_u, auth.uid(), 'invited');
      END IF;
    END LOOP;
  END IF;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_group(text, uuid[]) FROM anon;

CREATE OR REPLACE FUNCTION public.invite_to_group(p_team_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t RECORD; v_count int;
BEGIN
  SELECT * INTO t FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF t.id IS NULL OR t.creator_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le créateur peut inviter'; END IF;
  IF t.status <> 'waiting' OR t.expires_at <= now() THEN RAISE EXCEPTION 'Ce groupe n''accepte plus de membres'; END IF;
  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = p_team_id;
  IF v_count >= 5 THEN RAISE EXCEPTION 'Un groupe contient 5 participants maximum'; END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Déjà invité';
  END IF;
  INSERT INTO public.team_members (team_id, user_id, invited_by, status) VALUES (p_team_id, p_user_id, auth.uid(), 'invited');
END; $$;
REVOKE EXECUTE ON FUNCTION public.invite_to_group(uuid, uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.accept_team_invite(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t RECORD; v_count int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO t FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF t.id IS NULL OR t.status <> 'waiting' OR t.expires_at <= now() THEN
    RAISE EXCEPTION 'Ce groupe n''est plus disponible';
  END IF;
  IF public.user_active_group(auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'Tu fais déjà partie d''un groupe actif';
  END IF;
  SELECT count(*) INTO v_count FROM public.team_members WHERE team_id = p_team_id AND status = 'accepted';
  IF v_count >= 5 THEN RAISE EXCEPTION 'Groupe complet'; END IF;
  UPDATE public.team_members SET status = 'accepted'
   WHERE team_id = p_team_id AND user_id = auth.uid() AND status = 'invited';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
END; $$;

-- Fermer un groupe (expiration, suppression ou fin de défi)
CREATE OR REPLACE FUNCTION public.close_group(p_team_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ch RECORD;
BEGIN
  UPDATE public.teams SET status = p_status, closed_at = now() WHERE id = p_team_id;
  FOR ch IN SELECT id, team_a_id, team_b_id FROM public.challenges
            WHERE status = 'pending' AND (team_a_id = p_team_id OR team_b_id = p_team_id) LOOP
    UPDATE public.challenges SET status = 'cancelled' WHERE id = ch.id;
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT t.creator_id, 'group_challenge_cancelled', 'Proposition annulée',
           'Une proposition de défi de groupe a été annulée (groupe indisponible).', ch.id
    FROM public.teams t WHERE t.id IN (ch.team_a_id, ch.team_b_id) AND t.id <> p_team_id;
  END LOOP;
  DELETE FROM public.team_members WHERE team_id = p_team_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.close_group(uuid, text) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.delete_group(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t RECORD;
BEGIN
  SELECT * INTO t FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF t.id IS NULL OR t.creator_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le créateur peut supprimer le groupe'; END IF;
  IF t.status = 'in_challenge' THEN RAISE EXCEPTION 'Impossible pendant un défi'; END IF;
  PERFORM public.close_group(p_team_id, 'closed');
END; $$;
REVOKE EXECUTE ON FUNCTION public.delete_group(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.propose_group_challenge(p_my_team uuid, p_target_team uuid, p_distance_km numeric, p_stake_fp numeric, p_hours integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a RECORD; b RECORD; v_na int; v_nb int; v_id uuid; v_low int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_distance_km NOT IN (5, 10, 15, 20) THEN RAISE EXCEPTION 'Distance non autorisée'; END IF;
  IF p_stake_fp NOT IN (5, 10, 20, 50) THEN RAISE EXCEPTION 'Mise non autorisée'; END IF;
  IF p_hours NOT IN (24, 48, 72, 168) THEN RAISE EXCEPTION 'Durée non autorisée'; END IF;
  IF p_my_team = p_target_team THEN RAISE EXCEPTION 'Tu ne peux pas défier ton propre groupe'; END IF;
  SELECT * INTO a FROM public.teams WHERE id = p_my_team;
  SELECT * INTO b FROM public.teams WHERE id = p_target_team;
  IF a.id IS NULL OR a.creator_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le créateur du groupe peut lancer un défi'; END IF;
  IF a.status <> 'waiting' OR a.expires_at <= now() THEN RAISE EXCEPTION 'Ton groupe n''est plus disponible'; END IF;
  IF b.id IS NULL OR b.status <> 'waiting' OR b.expires_at <= now() THEN RAISE EXCEPTION 'Le groupe adverse n''est plus disponible'; END IF;
  SELECT count(*) INTO v_na FROM public.team_members WHERE team_id = a.id AND status = 'accepted';
  SELECT count(*) INTO v_nb FROM public.team_members WHERE team_id = b.id AND status = 'accepted';
  IF v_na < 2 OR v_na > 5 THEN RAISE EXCEPTION 'Ton groupe doit compter 2 à 5 participants'; END IF;
  IF v_nb < 2 OR v_nb > 5 THEN RAISE EXCEPTION 'Le groupe adverse doit compter 2 à 5 participants'; END IF;
  IF EXISTS (SELECT 1 FROM public.challenges WHERE status = 'pending' AND team_a_id = a.id) THEN
    RAISE EXCEPTION 'Ton groupe a déjà une proposition en attente';
  END IF;
  SELECT count(*) INTO v_low FROM public.team_members m JOIN public.profiles p ON p.user_id = m.user_id
   WHERE m.team_id = a.id AND m.status = 'accepted' AND COALESCE(p.total_fp, 0) < p_stake_fp;
  IF v_low > 0 THEN
    RAISE EXCEPTION 'Un ou plusieurs membres ne possèdent pas suffisamment de FP pour participer à ce défi.';
  END IF;
  INSERT INTO public.challenges (team_a_id, team_b_id, team_a_name, team_b_name, distance_km, status,
    time_limit_hours, stake_fp, coffre_amount, coffre_fee, reward_fp, winner_reward, max_members)
  VALUES (a.id, b.id, a.name, b.name, p_distance_km, 'pending', p_hours, p_stake_fp, 0, 1, p_stake_fp, 0, GREATEST(v_na, v_nb))
  RETURNING id INTO v_id;
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (b.creator_id, 'group_challenge', '🏆 Nouveau défi de groupe',
    'Le groupe ' || a.name || ' te propose un défi de ' || trim(to_char(p_distance_km, 'FM999D##')) || ' km. Mise : ' || p_stake_fp::int || ' FP par participant.', v_id);
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.propose_group_challenge(uuid, uuid, numeric, numeric, integer) FROM anon;

CREATE OR REPLACE FUNCTION public.respond_group_challenge(p_challenge_id uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c RECORD; a RECORD; b RECORD; v_ma uuid[]; v_mb uuid[]; v_low int; v_u uuid;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'pending' THEN RAISE EXCEPTION 'Ce défi n''est plus disponible'; END IF;
  SELECT * INTO a FROM public.teams WHERE id = c.team_a_id FOR UPDATE;
  SELECT * INTO b FROM public.teams WHERE id = c.team_b_id FOR UPDATE;
  IF b.creator_id <> auth.uid() THEN RAISE EXCEPTION 'Seul le créateur du groupe peut répondre'; END IF;

  IF NOT p_accept THEN
    UPDATE public.challenges SET status = 'cancelled' WHERE id = c.id;
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (a.creator_id, 'group_challenge_refused', 'Défi refusé', 'Le groupe ' || b.name || ' a refusé ton défi.', c.id);
    RETURN;
  END IF;

  IF a.status <> 'waiting' OR a.expires_at <= now() OR b.status <> 'waiting' OR b.expires_at <= now() THEN
    RAISE EXCEPTION 'Un des groupes n''est plus disponible';
  END IF;
  SELECT array_agg(user_id ORDER BY user_id) INTO v_ma FROM public.team_members WHERE team_id = a.id AND status = 'accepted';
  SELECT array_agg(user_id ORDER BY user_id) INTO v_mb FROM public.team_members WHERE team_id = b.id AND status = 'accepted';
  IF COALESCE(array_length(v_ma,1),0) NOT BETWEEN 2 AND 5 OR COALESCE(array_length(v_mb,1),0) NOT BETWEEN 2 AND 5 THEN
    RAISE EXCEPTION 'Chaque groupe doit compter 2 à 5 participants';
  END IF;
  IF v_ma && v_mb THEN RAISE EXCEPTION 'Un participant ne peut pas être dans les deux groupes'; END IF;

  PERFORM 1 FROM public.profiles WHERE user_id = ANY(v_ma || v_mb) ORDER BY user_id FOR UPDATE;
  SELECT count(*) INTO v_low FROM public.profiles WHERE user_id = ANY(v_ma || v_mb) AND COALESCE(total_fp,0) < c.stake_fp;
  IF v_low > 0 OR (SELECT count(*) FROM public.profiles WHERE user_id = ANY(v_ma || v_mb)) < array_length(v_ma || v_mb, 1) THEN
    RAISE EXCEPTION 'Un ou plusieurs membres ne possèdent pas suffisamment de FP pour participer à ce défi.';
  END IF;
  UPDATE public.profiles SET total_fp = total_fp - c.stake_fp, updated_at = now() WHERE user_id = ANY(v_ma || v_mb);

  UPDATE public.challenges SET status = 'active', team_a_members = v_ma, team_b_members = v_mb,
    coffre_amount = c.stake_fp * array_length(v_ma || v_mb, 1),
    accepted_at = now(), start_date = now(), end_date = now() + make_interval(hours => COALESCE(c.time_limit_hours, 72))
  WHERE id = c.id;
  UPDATE public.teams SET status = 'in_challenge' WHERE id IN (a.id, b.id);

  -- Annuler les autres propositions impliquant ces groupes
  UPDATE public.challenges SET status = 'cancelled'
   WHERE status = 'pending' AND id <> c.id AND (team_a_id IN (a.id, b.id) OR team_b_id IN (a.id, b.id));

  FOREACH v_u IN ARRAY (v_ma || v_mb) LOOP
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (v_u, 'group_challenge_started', '⚔️ Défi de groupe lancé',
      a.name || ' vs ' || b.name || ' · ' || c.distance_km || ' km · ' || c.stake_fp::int || ' FP bloqués dans le coffre.', c.id);
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.respond_group_challenge(uuid, boolean) FROM anon;

DROP FUNCTION IF EXISTS public.finalize_team_challenge(uuid);
CREATE FUNCTION public.finalize_team_challenge(p_challenge_id uuid)
RETURNS TABLE(winner_team_id uuid, avg_a numeric, avg_b numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c RECORD; v_ca int; v_cb int; v_aa numeric; v_ab numeric; v_winner uuid; v_tie boolean := false;
  v_payout numeric; v_per numeric; v_wm uuid[]; v_u uuid; v_all_done boolean;
BEGIN
  SELECT * INTO c FROM public.challenges ch WHERE ch.id = p_challenge_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF c.status = 'completed' THEN
    RETURN QUERY SELECT c.winner_team_id, c.team_a_avg_time, c.team_b_avg_time; RETURN;
  END IF;
  IF c.status <> 'active' THEN RAISE EXCEPTION 'Défi non actif'; END IF;

  SELECT count(*) INTO v_ca FROM public.challenge_participations p WHERE p.challenge_id = c.id AND p.completed AND p.user_id = ANY(c.team_a_members);
  SELECT count(*) INTO v_cb FROM public.challenge_participations p WHERE p.challenge_id = c.id AND p.completed AND p.user_id = ANY(c.team_b_members);
  v_all_done := v_ca >= array_length(c.team_a_members,1) AND v_cb >= array_length(c.team_b_members,1);
  IF NOT v_all_done AND c.end_date > now() THEN RAISE EXCEPTION 'Le défi n''est pas encore terminé'; END IF;

  SELECT AVG(p.duration_seconds) INTO v_aa FROM public.challenge_participations p WHERE p.challenge_id = c.id AND p.completed AND p.user_id = ANY(c.team_a_members);
  SELECT AVG(p.duration_seconds) INTO v_ab FROM public.challenge_participations p WHERE p.challenge_id = c.id AND p.completed AND p.user_id = ANY(c.team_b_members);

  IF v_ca = 0 AND v_cb = 0 THEN v_tie := true;
  ELSIF v_cb = 0 THEN v_winner := c.team_a_id;
  ELSIF v_ca = 0 THEN v_winner := c.team_b_id;
  ELSIF v_aa < v_ab THEN v_winner := c.team_a_id;
  ELSIF v_ab < v_aa THEN v_winner := c.team_b_id;
  ELSE v_tie := true;
  END IF;

  IF v_tie THEN
    v_payout := 0;
    UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + c.stake_fp, updated_at = now()
     WHERE user_id = ANY(c.team_a_members || c.team_b_members);
    FOREACH v_u IN ARRAY (c.team_a_members || c.team_b_members) LOOP
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (v_u, 'group_challenge_tie', 'Égalité 🤝', 'Défi de groupe à égalité : ta mise de ' || c.stake_fp::int || ' FP t''est rendue.', c.id);
    END LOOP;
  ELSE
    v_payout := GREATEST(c.coffre_amount - c.coffre_fee, 0);
    v_wm := CASE WHEN v_winner = c.team_a_id THEN c.team_a_members ELSE c.team_b_members END;
    v_per := ROUND(v_payout / array_length(v_wm,1), 2);
    UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_per, updated_at = now() WHERE user_id = ANY(v_wm);
    FOREACH v_u IN ARRAY (c.team_a_members || c.team_b_members) LOOP
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (v_u,
        CASE WHEN v_u = ANY(v_wm) THEN 'challenge_won' ELSE 'challenge_lost' END,
        CASE WHEN v_u = ANY(v_wm) THEN 'Victoire de groupe 🏆' ELSE 'Défi de groupe terminé' END,
        CASE WHEN v_u = ANY(v_wm) THEN 'Ton groupe a gagné ! +' || v_per || ' FP du coffre' ELSE 'Ton groupe a perdu, mise perdue.' END,
        c.id);
    END LOOP;
  END IF;

  UPDATE public.challenges SET status = 'completed', winner_team_id = v_winner, is_tie = v_tie,
    team_a_avg_time = v_aa, team_b_avg_time = v_ab, winner_reward = v_payout
  WHERE id = c.id;

  PERFORM public.close_group(c.team_a_id, 'closed');
  PERFORM public.close_group(c.team_b_id, 'closed');

  RETURN QUERY SELECT v_winner, v_aa, v_ab;
END; $$;
REVOKE EXECUTE ON FUNCTION public.finalize_team_challenge(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.submit_team_challenge_run(p_challenge_id uuid, p_distance_km numeric, p_duration_seconds integer, p_total_fp numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c RECORD; v_team uuid; v_prev RECORD; v_done boolean; v_time int; v_total int; v_fin int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = p_challenge_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'active' OR c.end_date <= now() THEN RAISE EXCEPTION 'Défi non actif'; END IF;
  IF auth.uid() = ANY(c.team_a_members) THEN v_team := c.team_a_id;
  ELSIF auth.uid() = ANY(c.team_b_members) THEN v_team := c.team_b_id;
  ELSE RAISE EXCEPTION 'Tu ne participes pas à ce défi'; END IF;
  IF p_distance_km IS NULL OR p_distance_km <= 0 OR p_duration_seconds IS NULL OR p_duration_seconds <= 0 THEN RETURN; END IF;

  SELECT * INTO v_prev FROM public.challenge_participations WHERE challenge_id = c.id AND user_id = auth.uid();
  IF v_prev.id IS NOT NULL AND v_prev.completed THEN RETURN; END IF; -- temps final verrouillé

  v_done := p_distance_km >= c.distance_km;
  v_time := CASE WHEN v_done THEN GREATEST(1, ROUND(p_duration_seconds * c.distance_km / p_distance_km))::int ELSE p_duration_seconds END;

  IF v_prev.id IS NULL THEN
    INSERT INTO public.challenge_participations (challenge_id, team_id, user_id, distance_km, duration_seconds, total_fp, completed)
    VALUES (c.id, v_team, auth.uid(), CASE WHEN v_done THEN c.distance_km ELSE p_distance_km END, v_time, COALESCE(p_total_fp,0), v_done);
  ELSIF v_done OR p_distance_km > v_prev.distance_km THEN
    UPDATE public.challenge_participations
       SET distance_km = CASE WHEN v_done THEN c.distance_km ELSE p_distance_km END,
           duration_seconds = v_time, completed = v_done, total_fp = COALESCE(p_total_fp,0)
     WHERE id = v_prev.id;
  END IF;

  SELECT count(*) INTO v_fin FROM public.challenge_participations WHERE challenge_id = c.id AND completed;
  v_total := array_length(c.team_a_members,1) + array_length(c.team_b_members,1);
  IF v_fin >= v_total THEN PERFORM public.finalize_team_challenge(c.id); END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.expire_team_challenges()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.challenges WHERE status = 'active' AND end_date <= now() LOOP
    BEGIN PERFORM public.finalize_team_challenge(r.id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN SELECT id FROM public.teams WHERE status = 'waiting' AND expires_at <= now() LOOP
    PERFORM public.close_group(r.id, 'expired');
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.my_group_challenges()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_me uuid := auth.uid(); v_groups jsonb; v_avail jsonb; v_ch jsonb;
BEGIN
  IF v_me IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'creator_id', t.creator_id, 'status', t.status, 'expires_at', t.expires_at,
    'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'status', m.status,
                  'username', p.username, 'avatar_url', p.avatar_url, 'total_fp', p.total_fp) ORDER BY m.created_at), '[]'::jsonb)
                FROM public.team_members m LEFT JOIN public.profiles p ON p.user_id = m.user_id WHERE m.team_id = t.id)
  ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_groups
  FROM public.teams t
  WHERE t.status IN ('waiting','in_challenge') AND (t.status = 'in_challenge' OR t.expires_at > now())
    AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = t.id AND m.user_id = v_me AND m.status = 'accepted');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'expires_at', t.expires_at,
    'creator_username', (SELECT username FROM public.profiles WHERE user_id = t.creator_id),
    'size', (SELECT count(*) FROM public.team_members m WHERE m.team_id = t.id AND m.status = 'accepted')
  ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_avail
  FROM public.teams t
  WHERE t.status = 'waiting' AND t.expires_at > now()
    AND NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = t.id AND m.user_id = v_me)
    AND (SELECT count(*) FROM public.team_members m WHERE m.team_id = t.id AND m.status = 'accepted') BETWEEN 2 AND 5;

  WITH mine AS (
    SELECT c.* FROM public.challenges c
    WHERE c.status IN ('pending','active','completed')
      AND (v_me = ANY(COALESCE(c.team_a_members,'{}')) OR v_me = ANY(COALESCE(c.team_b_members,'{}'))
           OR (c.status = 'pending' AND EXISTS (SELECT 1 FROM public.team_members m
                 WHERE m.user_id = v_me AND m.status = 'accepted' AND m.team_id IN (c.team_a_id, c.team_b_id))))
    ORDER BY c.created_at DESC LIMIT 40
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status, 'distance_km', c.distance_km, 'stake_fp', c.stake_fp,
    'coffre_amount', c.coffre_amount, 'coffre_fee', c.coffre_fee, 'winner_reward', c.winner_reward,
    'time_limit_hours', c.time_limit_hours, 'end_date', c.end_date, 'created_at', c.created_at,
    'winner_team_id', c.winner_team_id, 'is_tie', c.is_tie,
    'avg_a', c.team_a_avg_time, 'avg_b', c.team_b_avg_time,
    'team_a', jsonb_build_object('id', c.team_a_id, 'name', COALESCE(c.team_a_name, ta.name), 'creator_id', ta.creator_id),
    'team_b', jsonb_build_object('id', c.team_b_id, 'name', COALESCE(c.team_b_name, tb.name), 'creator_id', tb.creator_id),
    'members_a', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', u, 'username', p.username, 'avatar_url', p.avatar_url,
                    'distance_km', cp.distance_km, 'duration_seconds', cp.duration_seconds, 'completed', COALESCE(cp.completed,false))), '[]'::jsonb)
                  FROM unnest(COALESCE(c.team_a_members, ARRAY(SELECT user_id FROM public.team_members WHERE team_id = c.team_a_id AND status='accepted'))) u
                  LEFT JOIN public.profiles p ON p.user_id = u
                  LEFT JOIN public.challenge_participations cp ON cp.challenge_id = c.id AND cp.user_id = u),
    'members_b', (SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', u, 'username', p.username, 'avatar_url', p.avatar_url,
                    'distance_km', cp.distance_km, 'duration_seconds', cp.duration_seconds, 'completed', COALESCE(cp.completed,false))), '[]'::jsonb)
                  FROM unnest(COALESCE(c.team_b_members, ARRAY(SELECT user_id FROM public.team_members WHERE team_id = c.team_b_id AND status='accepted'))) u
                  LEFT JOIN public.profiles p ON p.user_id = u
                  LEFT JOIN public.challenge_participations cp ON cp.challenge_id = c.id AND cp.user_id = u)
  ) ORDER BY c.created_at DESC), '[]'::jsonb) INTO v_ch
  FROM mine c LEFT JOIN public.teams ta ON ta.id = c.team_a_id LEFT JOIN public.teams tb ON tb.id = c.team_b_id;

  RETURN jsonb_build_object('groups', v_groups, 'available', v_avail, 'challenges', v_ch);
END; $$;
REVOKE EXECUTE ON FUNCTION public.my_group_challenges() FROM anon;

DROP FUNCTION IF EXISTS public.start_team_challenge(uuid, numeric, numeric, timestamptz);
DROP FUNCTION IF EXISTS public.accept_team_challenge(uuid, uuid);
