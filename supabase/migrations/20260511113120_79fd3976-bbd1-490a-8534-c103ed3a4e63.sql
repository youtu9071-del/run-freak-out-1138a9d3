
-- ============================================================
-- 1. CHALLENGES (équipes) : mise par membre + coffre + max 10km
-- ============================================================
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS stake_fp NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coffre_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coffre_fee NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS winner_reward NUMERIC NOT NULL DEFAULT 0;

-- Validation distance <= 10 (via trigger, pas CHECK)
CREATE OR REPLACE FUNCTION public.validate_team_challenge_distance()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.distance_km IS NOT NULL AND NEW.distance_km > 10 THEN
    RAISE EXCEPTION 'La distance maximale d''un défi d''équipe est 10 km';
  END IF;
  IF NEW.distance_km IS NOT NULL AND NEW.distance_km < 1 THEN
    RAISE EXCEPTION 'La distance minimale est 1 km';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_challenge_distance ON public.challenges;
CREATE TRIGGER trg_validate_team_challenge_distance
  BEFORE INSERT OR UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_challenge_distance();

-- Nouvelle signature : start_team_challenge avec stake_fp
DROP FUNCTION IF EXISTS public.start_team_challenge(uuid, numeric, numeric, timestamp with time zone);
CREATE OR REPLACE FUNCTION public.start_team_challenge(
  p_team_id uuid,
  p_distance_km numeric,
  p_stake_fp numeric,
  p_end_date timestamp with time zone
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_challenge_id uuid;
  v_creator uuid;
  v_member RECORD;
  v_balance numeric;
  v_member_count integer;
  v_total_stake numeric := 0;
BEGIN
  IF p_distance_km > 10 THEN RAISE EXCEPTION 'Distance max 10 km'; END IF;
  IF p_stake_fp < 0 THEN RAISE EXCEPTION 'Mise invalide'; END IF;

  SELECT creator_id INTO v_creator FROM public.teams WHERE id = p_team_id;
  IF v_creator IS NULL OR v_creator <> auth.uid() THEN
    RAISE EXCEPTION 'Seul le créateur de l''équipe peut lancer un défi';
  END IF;

  -- Vérifier que TOUS les membres ont assez de FP
  FOR v_member IN
    SELECT user_id FROM public.team_members WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    SELECT COALESCE(total_fp, 0) INTO v_balance FROM public.profiles WHERE user_id = v_member.user_id FOR UPDATE;
    IF v_balance < p_stake_fp THEN
      RAISE EXCEPTION 'Un membre de l''équipe n''a pas assez de FP (% requis)', p_stake_fp;
    END IF;
  END LOOP;

  -- Prélever la mise de chaque membre
  v_member_count := 0;
  FOR v_member IN
    SELECT user_id FROM public.team_members WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    UPDATE public.profiles SET total_fp = total_fp - p_stake_fp, updated_at = now()
      WHERE user_id = v_member.user_id;
    v_member_count := v_member_count + 1;
    v_total_stake := v_total_stake + p_stake_fp;
  END LOOP;

  INSERT INTO public.challenges (team_a_id, team_b_id, distance_km, status, start_date, end_date,
                                  stake_fp, coffre_amount, reward_fp)
  VALUES (p_team_id, NULL, p_distance_km, 'open', now(), p_end_date,
          p_stake_fp, v_total_stake, p_stake_fp)
  RETURNING id INTO v_challenge_id;

  RETURN v_challenge_id;
END;
$$;

-- accept_team_challenge : prélève aussi à team B
CREATE OR REPLACE FUNCTION public.accept_team_challenge(p_challenge_id uuid, p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_a uuid; v_status challenge_status;
  v_creator uuid; v_size_a integer; v_size_b integer;
  v_stake numeric; v_member RECORD; v_balance numeric;
BEGIN
  SELECT team_a_id, status, stake_fp INTO v_team_a, v_status, v_stake
    FROM public.challenges WHERE id = p_challenge_id;
  IF v_team_a IS NULL THEN RAISE EXCEPTION 'Défi introuvable'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Défi non disponible'; END IF;
  IF v_team_a = p_team_id THEN RAISE EXCEPTION 'Tu ne peux pas affronter ta propre équipe'; END IF;

  SELECT creator_id INTO v_creator FROM public.teams WHERE id = p_team_id;
  IF v_creator <> auth.uid() THEN RAISE EXCEPTION 'Seul le créateur de l''équipe peut accepter'; END IF;

  SELECT public.get_team_member_count(v_team_a) INTO v_size_a;
  SELECT public.get_team_member_count(p_team_id) INTO v_size_b;
  IF v_size_a <> v_size_b THEN
    RAISE EXCEPTION 'Les deux équipes doivent avoir le même nombre de membres (% vs %)', v_size_a, v_size_b;
  END IF;

  -- Vérifier les soldes FP de team B
  FOR v_member IN
    SELECT user_id FROM public.team_members WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    SELECT COALESCE(total_fp, 0) INTO v_balance FROM public.profiles WHERE user_id = v_member.user_id FOR UPDATE;
    IF v_balance < v_stake THEN
      RAISE EXCEPTION 'Un membre de ton équipe n''a pas assez de FP (% requis)', v_stake;
    END IF;
  END LOOP;

  -- Prélever
  FOR v_member IN
    SELECT user_id FROM public.team_members WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    UPDATE public.profiles SET total_fp = total_fp - v_stake, updated_at = now()
      WHERE user_id = v_member.user_id;
  END LOOP;

  UPDATE public.challenges
    SET team_b_id = p_team_id, status = 'active',
        coffre_amount = coffre_amount + (v_stake * v_size_b)
    WHERE id = p_challenge_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  SELECT t.creator_id, 'challenge_accepted', 'Défi relevé ⚔️',
         'Une équipe a relevé ton défi !', p_challenge_id
  FROM public.teams t WHERE t.id = v_team_a;
END;
$$;

-- finalize_team_challenge : distribution du coffre
CREATE OR REPLACE FUNCTION public.finalize_team_challenge(p_challenge_id uuid)
RETURNS TABLE(winner_team_id uuid, avg_a numeric, avg_b numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_a uuid; v_team_b uuid; v_status challenge_status;
  v_coffre numeric; v_fee numeric;
  v_size_a integer; v_size_b integer;
  v_count_a integer; v_count_b integer;
  v_avg_a numeric; v_avg_b numeric;
  v_winner uuid; v_winner_size integer; v_payout_total numeric; v_per_member numeric;
  v_member RECORD;
BEGIN
  SELECT team_a_id, team_b_id, coffre_amount, coffre_fee, status
    INTO v_team_a, v_team_b, v_coffre, v_fee, v_status
    FROM public.challenges WHERE id = p_challenge_id;

  IF v_status = 'completed' THEN
    SELECT c.winner_team_id, c.team_a_avg_time, c.team_b_avg_time
      INTO v_winner, v_avg_a, v_avg_b FROM public.challenges c WHERE c.id = p_challenge_id;
    RETURN QUERY SELECT v_winner, v_avg_a, v_avg_b; RETURN;
  END IF;

  SELECT public.get_team_member_count(v_team_a) INTO v_size_a;
  SELECT public.get_team_member_count(v_team_b) INTO v_size_b;

  SELECT COUNT(*), AVG(duration_seconds) INTO v_count_a, v_avg_a
    FROM public.challenge_participations WHERE challenge_id = p_challenge_id AND team_id = v_team_a AND completed = true;
  SELECT COUNT(*), AVG(duration_seconds) INTO v_count_b, v_avg_b
    FROM public.challenge_participations WHERE challenge_id = p_challenge_id AND team_id = v_team_b AND completed = true;

  IF v_count_a < v_size_a OR v_count_b < v_size_b THEN
    RAISE EXCEPTION 'Tous les membres doivent terminer (% / % vs % / %)', v_count_a, v_size_a, v_count_b, v_size_b;
  END IF;

  IF v_avg_a < v_avg_b THEN v_winner := v_team_a;
  ELSIF v_avg_b < v_avg_a THEN v_winner := v_team_b;
  ELSE v_winner := NULL;
  END IF;

  v_payout_total := GREATEST(v_coffre - v_fee, 0);

  IF v_winner IS NOT NULL THEN
    SELECT public.get_team_member_count(v_winner) INTO v_winner_size;
    IF v_winner_size > 0 THEN
      v_per_member := v_payout_total / v_winner_size;
      FOR v_member IN
        SELECT user_id FROM public.team_members WHERE team_id = v_winner AND status = 'accepted'
      LOOP
        UPDATE public.profiles SET total_fp = COALESCE(total_fp, 0) + v_per_member, updated_at = now()
          WHERE user_id = v_member.user_id;
        INSERT INTO public.notifications (user_id, type, title, message, related_id)
        VALUES (v_member.user_id, 'challenge_won', 'Victoire d''équipe 🏆',
                'Ton équipe a gagné ! +' || ROUND(v_per_member, 2) || ' FP du coffre', p_challenge_id);
      END LOOP;
    END IF;
  ELSE
    -- Match nul : rembourser la mise à chaque participant
    FOR v_member IN
      SELECT user_id, team_id FROM public.team_members
      WHERE team_id IN (v_team_a, v_team_b) AND status = 'accepted'
    LOOP
      UPDATE public.profiles
        SET total_fp = COALESCE(total_fp, 0) + ((v_coffre - v_fee) / NULLIF(v_size_a + v_size_b, 0)),
            updated_at = now()
        WHERE user_id = v_member.user_id;
    END LOOP;
  END IF;

  UPDATE public.challenges
    SET status = 'completed', winner_team_id = v_winner,
        team_a_avg_time = v_avg_a, team_b_avg_time = v_avg_b,
        winner_reward = v_payout_total
    WHERE id = p_challenge_id;

  -- Notifier équipe perdante
  IF v_winner IS NOT NULL THEN
    FOR v_member IN
      SELECT user_id FROM public.team_members
      WHERE team_id IN (v_team_a, v_team_b) AND team_id <> v_winner AND status = 'accepted'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (v_member.user_id, 'challenge_lost', 'Défi terminé',
              'Ton équipe a perdu, mise perdue', p_challenge_id);
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_winner, v_avg_a, v_avg_b;
END;
$$;

-- ============================================================
-- 2. DÉFIS 1v1 : niveau + mise FP + coffre
-- ============================================================
ALTER TABLE public.challenge_invites
  ADD COLUMN IF NOT EXISTS challenge_level TEXT,
  ADD COLUMN IF NOT EXISTS stake_fp NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coffre_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coffre_fee NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS winner_reward NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winner_id UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Map niveau -> mise minimale
CREATE OR REPLACE FUNCTION public.duel_level_stake(p_level text)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_level
    WHEN 'ROOKIE I' THEN 5
    WHEN 'ROOKIE II' THEN 10
    WHEN 'STREET RACER' THEN 15
    WHEN 'PRO RACER' THEN 20
    WHEN 'ELITE RACER' THEN 30
    WHEN 'LEGEND RACER' THEN 40
    WHEN 'FREAK MASTER' THEN 50
    ELSE 5
  END::NUMERIC;
$$;

-- Créer une invitation 1v1 (prélève la mise du challenger)
CREATE OR REPLACE FUNCTION public.create_duel_invite(
  p_challenged uuid,
  p_distance numeric,
  p_level text,
  p_scheduled timestamp with time zone DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stake numeric;
  v_balance numeric;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth requise'; END IF;
  IF p_challenged = auth.uid() THEN RAISE EXCEPTION 'Tu ne peux pas te défier toi-même'; END IF;
  v_stake := public.duel_level_stake(p_level);

  SELECT COALESCE(total_fp, 0) INTO v_balance FROM public.profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF v_balance < v_stake THEN
    RAISE EXCEPTION 'Solde FP insuffisant : % requis, tu as %', v_stake, v_balance;
  END IF;

  UPDATE public.profiles SET total_fp = total_fp - v_stake, updated_at = now()
    WHERE user_id = auth.uid();

  INSERT INTO public.challenge_invites (
    challenger_id, challenged_id, distance_km, challenge_level, stake_fp,
    coffre_amount, scheduled_date, status
  ) VALUES (
    auth.uid(), p_challenged, p_distance, p_level, v_stake,
    v_stake, p_scheduled, 'pending'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Accepter un défi 1v1 (prélève la mise de l'adversaire)
CREATE OR REPLACE FUNCTION public.accept_duel_invite(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    SET status = 'accepted', responded_at = now(),
        coffre_amount = coffre_amount + stake_fp
    WHERE id = p_invite_id;
END;
$$;

-- Refuser : rembourser la mise du challenger
CREATE OR REPLACE FUNCTION public.refuse_duel_invite(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite RECORD;
BEGIN
  SELECT * INTO v_invite FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF v_invite.challenged_id <> auth.uid() THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'Déjà traité'; END IF;

  -- Rembourser le challenger
  IF v_invite.stake_fp > 0 THEN
    UPDATE public.profiles SET total_fp = total_fp + v_invite.stake_fp, updated_at = now()
      WHERE user_id = v_invite.challenger_id;
  END IF;

  UPDATE public.challenge_invites
    SET status = 'refused', responded_at = now()
    WHERE id = p_invite_id;
END;
$$;

-- Finaliser un duel 1v1 : winner reçoit coffre - 1
CREATE OR REPLACE FUNCTION public.finalize_duel(p_invite_id uuid, p_winner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite RECORD; v_payout numeric;
BEGIN
  SELECT * INTO v_invite FROM public.challenge_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.id IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF v_invite.status <> 'accepted' THEN RAISE EXCEPTION 'Défi non actif'; END IF;
  IF p_winner_id NOT IN (v_invite.challenger_id, v_invite.challenged_id) THEN
    RAISE EXCEPTION 'Vainqueur invalide';
  END IF;

  v_payout := GREATEST(v_invite.coffre_amount - v_invite.coffre_fee, 0);
  UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_payout, updated_at = now()
    WHERE user_id = p_winner_id;

  UPDATE public.challenge_invites
    SET status = 'completed', winner_id = p_winner_id,
        winner_reward = v_payout, completed_at = now()
    WHERE id = p_invite_id;

  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (p_winner_id, 'duel_won', 'Duel gagné 🏆',
          'Tu as gagné le duel ! +' || v_payout || ' FP', p_invite_id);
END;
$$;
