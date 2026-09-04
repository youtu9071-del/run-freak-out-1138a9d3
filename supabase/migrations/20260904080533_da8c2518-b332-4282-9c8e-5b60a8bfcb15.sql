
-- 1. Colonnes de duel
ALTER TABLE public.challenge_invites
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS duel_ends_at timestamptz;

-- 2. Participations aux duels
CREATE TABLE IF NOT EXISTS public.duel_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.challenge_invites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  distance_km numeric NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_id, user_id)
);

GRANT SELECT ON public.duel_participations TO authenticated;
GRANT ALL ON public.duel_participations TO service_role;

ALTER TABLE public.duel_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Duel participants can view participations" ON public.duel_participations;
CREATE POLICY "Duel participants can view participations"
ON public.duel_participations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.challenge_invites ci
    WHERE ci.id = duel_participations.invite_id
      AND (ci.challenger_id = auth.uid() OR ci.challenged_id = auth.uid())
  )
);

-- 3. Création d'un duel : mise fixe 5 FP, frais 1 FP, pas de doublon
CREATE OR REPLACE FUNCTION public.create_duel_invite(
  p_challenged uuid, p_distance numeric, p_level text,
  p_scheduled timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stake numeric := 5;
  v_balance numeric;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth requise'; END IF;
  IF p_challenged = auth.uid() THEN RAISE EXCEPTION 'Tu ne peux pas te défier toi-même'; END IF;
  IF COALESCE(p_distance, 0) <= 0 THEN RAISE EXCEPTION 'Distance invalide'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.challenge_invites
    WHERE status IN ('pending','accepted')
      AND ((challenger_id = auth.uid() AND challenged_id = p_challenged)
        OR (challenger_id = p_challenged AND challenged_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Un défi est déjà en cours avec ce joueur';
  END IF;

  SELECT COALESCE(total_fp, 0) INTO v_balance FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF v_balance < v_stake THEN
    RAISE EXCEPTION 'Solde FP insuffisant : % FP requis, tu as %', v_stake, v_balance;
  END IF;

  UPDATE public.profiles SET total_fp = total_fp - v_stake, updated_at = now()
    WHERE user_id = auth.uid();

  INSERT INTO public.challenge_invites (
    challenger_id, challenged_id, distance_km, challenge_level, stake_fp,
    coffre_amount, coffre_fee, scheduled_date, status, expires_at
  ) VALUES (
    auth.uid(), p_challenged, p_distance, p_level, v_stake,
    v_stake, 1, p_scheduled, 'pending', now() + interval '72 hours'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- 4. Acceptation : démarre le compte à rebours de 72 h
CREATE OR REPLACE FUNCTION public.accept_duel_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_balance numeric;
BEGIN
  SELECT * INTO v_invite FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF v_invite.challenged_id <> auth.uid() THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'Défi non en attente'; END IF;

  SELECT COALESCE(total_fp, 0) INTO v_balance FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF v_balance < v_invite.stake_fp THEN
    RAISE EXCEPTION 'Solde FP insuffisant : % requis, tu as %', v_invite.stake_fp, v_balance;
  END IF;

  UPDATE public.profiles SET total_fp = total_fp - v_invite.stake_fp, updated_at = now()
    WHERE user_id = auth.uid();

  UPDATE public.challenge_invites
    SET status = 'accepted', responded_at = now(), accepted_at = now(),
        duel_ends_at = now() + interval '72 hours',
        coffre_amount = coffre_amount + stake_fp
    WHERE id = p_invite_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (v_invite.challenger_id, 'duel_accepted', 'Défi accepté ⚔️',
          'Ton défi a été accepté ! 72 h pour faire ta course.', p_invite_id);
END;
$function$;

-- 5. Enregistrement d'une participation à un duel
CREATE OR REPLACE FUNCTION public.submit_duel_run(
  p_invite_id uuid, p_distance_km numeric, p_duration_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_invite RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth requise'; END IF;

  SELECT * INTO v_invite FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF v_invite.status <> 'accepted' THEN RAISE EXCEPTION 'Défi non actif'; END IF;
  IF auth.uid() NOT IN (v_invite.challenger_id, v_invite.challenged_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF v_invite.duel_ends_at IS NOT NULL AND v_invite.duel_ends_at < now() THEN
    RAISE EXCEPTION 'Défi expiré';
  END IF;
  IF EXISTS (SELECT 1 FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Tu as déjà participé à ce défi';
  END IF;

  INSERT INTO public.duel_participations (invite_id, user_id, distance_km, duration_seconds, completed)
  VALUES (p_invite_id, auth.uid(), COALESCE(p_distance_km,0), COALESCE(p_duration_seconds,0),
          COALESCE(p_distance_km,0) >= v_invite.distance_km);
END;
$function$;

-- 6. Résolution automatique d'un duel
CREATE OR REPLACE FUNCTION public.finalize_duel_auto(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v RECORD; a RECORD; b RECORD;
  v_winner uuid; v_payout numeric; v_tie boolean := false;
BEGIN
  SELECT * INTO v FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v.id IS NULL OR v.status <> 'accepted' THEN RETURN; END IF;
  IF v.duel_ends_at IS NULL OR v.duel_ends_at > now() THEN RETURN; END IF;

  SELECT * INTO a FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = v.challenger_id;
  SELECT * INTO b FROM public.duel_participations WHERE invite_id = p_invite_id AND user_id = v.challenged_id;

  IF a.id IS NULL AND b.id IS NULL THEN
    v_tie := true;
  ELSIF a.id IS NULL THEN v_winner := v.challenged_id;
  ELSIF b.id IS NULL THEN v_winner := v.challenger_id;
  ELSIF a.completed AND NOT b.completed THEN v_winner := v.challenger_id;
  ELSIF b.completed AND NOT a.completed THEN v_winner := v.challenged_id;
  ELSIF a.completed AND b.completed THEN
    IF a.duration_seconds < b.duration_seconds THEN v_winner := v.challenger_id;
    ELSIF b.duration_seconds < a.duration_seconds THEN v_winner := v.challenged_id;
    ELSE v_tie := true; END IF;
  ELSE
    IF a.distance_km > b.distance_km THEN v_winner := v.challenger_id;
    ELSIF b.distance_km > a.distance_km THEN v_winner := v.challenged_id;
    ELSE v_tie := true; END IF;
  END IF;

  IF v_tie THEN
    -- Égalité parfaite : chaque joueur récupère intégralement sa mise, aucun frais prélevé
    UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v.stake_fp, updated_at = now()
      WHERE user_id IN (v.challenger_id, v.challenged_id);
    UPDATE public.challenge_invites
      SET status = 'completed', winner_id = NULL, winner_reward = 0, completed_at = now()
      WHERE id = p_invite_id;
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT u, 'duel_tie', 'Duel : égalité 🤝',
           'Égalité parfaite — ta mise de ' || v.stake_fp || ' FP t''a été restituée.', p_invite_id
    FROM unnest(ARRAY[v.challenger_id, v.challenged_id]) AS u;
    RETURN;
  END IF;

  v_payout := GREATEST(COALESCE(v.coffre_amount,0) - COALESCE(v.coffre_fee,0), 0);

  UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_payout, updated_at = now()
    WHERE user_id = v_winner;

  UPDATE public.challenge_invites
    SET status = 'completed', winner_id = v_winner, winner_reward = v_payout, completed_at = now()
    WHERE id = p_invite_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (v_winner, 'duel_won', 'Duel gagné 🏆',
          'Coffre ouvert ! +' || v_payout || ' FP', p_invite_id);

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (CASE WHEN v_winner = v.challenger_id THEN v.challenged_id ELSE v.challenger_id END,
          'duel_lost', 'Duel terminé', 'Ton adversaire a remporté le coffre.', p_invite_id);
END;
$function$;

-- 7. Balayage des duels arrivés à échéance
CREATE OR REPLACE FUNCTION public.expire_duels()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.challenge_invites
           WHERE status = 'accepted' AND duel_ends_at IS NOT NULL AND duel_ends_at < now()
  LOOP
    PERFORM public.finalize_duel_auto(r.id);
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.finalize_duel_auto(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_duel_invite(uuid, numeric, text, timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_duel_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_duel_run(uuid, numeric, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.expire_duels() TO authenticated;
