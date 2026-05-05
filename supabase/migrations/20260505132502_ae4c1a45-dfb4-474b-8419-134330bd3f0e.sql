-- 1) Add 'open' status to challenge_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'open' AND enumtypid = 'challenge_status'::regtype) THEN
    ALTER TYPE challenge_status ADD VALUE 'open';
  END IF;
END$$;

-- 2) Add reward_fp column to challenges
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS reward_fp NUMERIC NOT NULL DEFAULT 50;
ALTER TABLE public.challenges ALTER COLUMN team_b_id DROP NOT NULL;

-- 3) Participations table
CREATE TABLE IF NOT EXISTS public.challenge_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  total_fp NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

ALTER TABLE public.challenge_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participations viewable by all authenticated"
  ON public.challenge_participations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can submit own participation"
  ON public.challenge_participations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
  ON public.challenge_participations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4) Function: start a team challenge (open, awaiting opponent)
CREATE OR REPLACE FUNCTION public.start_team_challenge(
  p_team_id UUID,
  p_distance_km NUMERIC,
  p_reward_fp NUMERIC,
  p_end_date TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_challenge_id UUID;
  v_creator UUID;
BEGIN
  SELECT creator_id INTO v_creator FROM public.teams WHERE id = p_team_id;
  IF v_creator IS NULL OR v_creator <> auth.uid() THEN
    RAISE EXCEPTION 'Only the team creator can launch a challenge';
  END IF;

  INSERT INTO public.challenges (team_a_id, team_b_id, distance_km, status, start_date, end_date, reward_fp)
  VALUES (p_team_id, NULL, p_distance_km, 'open', now(), p_end_date, p_reward_fp)
  RETURNING id INTO v_challenge_id;

  RETURN v_challenge_id;
END;
$$;

-- 5) Function: accept a challenge (team B same size as team A)
CREATE OR REPLACE FUNCTION public.accept_team_challenge(
  p_challenge_id UUID,
  p_team_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_a UUID;
  v_status challenge_status;
  v_creator UUID;
  v_size_a INTEGER;
  v_size_b INTEGER;
BEGIN
  SELECT team_a_id, status INTO v_team_a, v_status FROM public.challenges WHERE id = p_challenge_id;
  IF v_team_a IS NULL THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Challenge is no longer open'; END IF;
  IF v_team_a = p_team_id THEN RAISE EXCEPTION 'You cannot challenge your own team'; END IF;

  SELECT creator_id INTO v_creator FROM public.teams WHERE id = p_team_id;
  IF v_creator <> auth.uid() THEN RAISE EXCEPTION 'Only the team creator can accept'; END IF;

  SELECT public.get_team_member_count(v_team_a) INTO v_size_a;
  SELECT public.get_team_member_count(p_team_id) INTO v_size_b;
  IF v_size_a <> v_size_b THEN RAISE EXCEPTION 'Both teams must have the same number of members (% vs %)', v_size_a, v_size_b; END IF;

  UPDATE public.challenges
    SET team_b_id = p_team_id, status = 'active'
    WHERE id = p_challenge_id;

  -- Notify team A creator
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  SELECT t.creator_id, 'challenge_accepted', 'Défi relevé ⚔️',
         'Une équipe a relevé ton défi !', p_challenge_id
  FROM public.teams t WHERE t.id = v_team_a;
END;
$$;

-- 6) Function: submit a member's run for a challenge
CREATE OR REPLACE FUNCTION public.submit_team_challenge_run(
  p_challenge_id UUID,
  p_distance_km NUMERIC,
  p_duration_seconds INTEGER,
  p_total_fp NUMERIC
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_a UUID;
  v_team_b UUID;
  v_user_team UUID;
BEGIN
  SELECT team_a_id, team_b_id INTO v_team_a, v_team_b FROM public.challenges WHERE id = p_challenge_id;

  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = v_team_a AND user_id = auth.uid() AND status = 'accepted') THEN
    v_user_team := v_team_a;
  ELSIF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = v_team_b AND user_id = auth.uid() AND status = 'accepted') THEN
    v_user_team := v_team_b;
  ELSE
    RAISE EXCEPTION 'You are not a member of either team';
  END IF;

  INSERT INTO public.challenge_participations (challenge_id, team_id, user_id, distance_km, duration_seconds, total_fp, completed)
  VALUES (p_challenge_id, v_user_team, auth.uid(), p_distance_km, p_duration_seconds, p_total_fp, true)
  ON CONFLICT (challenge_id, user_id) DO UPDATE
    SET distance_km = EXCLUDED.distance_km,
        duration_seconds = EXCLUDED.duration_seconds,
        total_fp = EXCLUDED.total_fp,
        completed = true;
END;
$$;

-- 7) Function: finalize a challenge — compute averages, pick winner, distribute FP
CREATE OR REPLACE FUNCTION public.finalize_team_challenge(p_challenge_id UUID)
RETURNS TABLE(winner_team_id UUID, avg_a NUMERIC, avg_b NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_a UUID; v_team_b UUID; v_reward NUMERIC; v_status challenge_status;
  v_size_a INTEGER; v_size_b INTEGER;
  v_count_a INTEGER; v_count_b INTEGER;
  v_avg_a NUMERIC; v_avg_b NUMERIC;
  v_winner UUID;
  v_member RECORD;
BEGIN
  SELECT team_a_id, team_b_id, reward_fp, status INTO v_team_a, v_team_b, v_reward, v_status
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
    RAISE EXCEPTION 'Tous les membres des deux équipes doivent avoir terminé leur course (% / % vs % / %)', v_count_a, v_size_a, v_count_b, v_size_b;
  END IF;

  IF v_avg_a < v_avg_b THEN v_winner := v_team_a;
  ELSIF v_avg_b < v_avg_a THEN v_winner := v_team_b;
  ELSE v_winner := NULL; -- tie
  END IF;

  UPDATE public.challenges
    SET status = 'completed', winner_team_id = v_winner,
        team_a_avg_time = v_avg_a, team_b_avg_time = v_avg_b
    WHERE id = p_challenge_id;

  -- Distribute FP to winning team members
  IF v_winner IS NOT NULL THEN
    FOR v_member IN
      SELECT user_id FROM public.team_members WHERE team_id = v_winner AND status = 'accepted'
    LOOP
      UPDATE public.profiles SET total_fp = COALESCE(total_fp, 0) + v_reward, updated_at = now()
        WHERE user_id = v_member.user_id;
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (v_member.user_id, 'challenge_won', 'Victoire d''équipe 🏆',
              'Ton équipe a gagné ! +' || v_reward || ' FP', p_challenge_id);
    END LOOP;
  END IF;

  -- Notify losing team
  FOR v_member IN
    SELECT user_id FROM public.team_members
    WHERE team_id IN (v_team_a, v_team_b) AND team_id <> COALESCE(v_winner, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status = 'accepted'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (v_member.user_id, 'challenge_lost', 'Défi terminé',
            CASE WHEN v_winner IS NULL THEN 'Match nul ! Aucun FP attribué' ELSE 'Ton équipe a perdu, aucun FP attribué' END,
            p_challenge_id);
  END LOOP;

  RETURN QUERY SELECT v_winner, v_avg_a, v_avg_b;
END;
$$;