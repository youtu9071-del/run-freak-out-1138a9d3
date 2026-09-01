-- ============ SEASONS ============
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons_select_authenticated" ON public.seasons
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.seasons (number, started_at)
SELECT 1, timestamptz '1970-01-01'
WHERE NOT EXISTS (SELECT 1 FROM public.seasons);

CREATE TABLE IF NOT EXISTS public.season_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  season_from integer NOT NULL,
  season_to integer NOT NULL,
  users_affected integer NOT NULL DEFAULT 0,
  total_km_reset numeric NOT NULL DEFAULT 0,
  total_fp_reset numeric NOT NULL DEFAULT 0,
  duels_settled integer NOT NULL DEFAULT 0,
  team_challenges_settled integer NOT NULL DEFAULT 0,
  fp_refunded numeric NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.season_reset_logs TO authenticated;
GRANT ALL ON public.season_reset_logs TO service_role;
ALTER TABLE public.season_reset_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_logs_admin_select" ON public.season_reset_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ SEASON-AWARE STATS ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fp_base numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.current_season_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT started_at FROM public.seasons WHERE ended_at IS NULL ORDER BY number DESC LIMIT 1),
    timestamptz '1970-01-01'
  )
$$;

-- initialise fp_base sur la somme d'activités actuelle (aucun saut de solde)
UPDATE public.profiles p SET fp_base = COALESCE((
  SELECT SUM(a.total_fp) FROM public.user_activities a
  WHERE a.user_id = p.user_id AND a.integrity_status <> 'fraud'
    AND a.created_at >= public.current_season_start()
), 0);

CREATE OR REPLACE FUNCTION public.update_profile_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := public.current_season_start();
  v_km numeric; v_fp numeric; v_steps bigint; v_count integer;
BEGIN
  SELECT COALESCE(SUM(distance_km),0), COALESCE(SUM(total_fp),0),
         COALESCE(SUM(steps),0), COUNT(*)
    INTO v_km, v_fp, v_steps, v_count
    FROM public.user_activities
    WHERE user_id = p_user_id AND integrity_status <> 'fraud' AND created_at >= v_start;

  UPDATE public.profiles SET
    total_km = v_km,
    total_steps = v_steps,
    total_activities = v_count,
    -- préserve tous les mouvements FP hors course (market, mises, coffres)
    total_fp = GREATEST(COALESCE(total_fp,0) + (v_fp - COALESCE(fp_base,0)), 0),
    fp_base = v_fp,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ============ RESET ============
CREATE OR REPLACE FUNCTION public.admin_season_overview()
RETURNS TABLE(season_number integer, season_started_at timestamptz, users_count integer,
              total_km numeric, total_fp numeric, last_reset_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY
  SELECT s.number, s.started_at,
         (SELECT COUNT(*)::int FROM public.profiles),
         (SELECT COALESCE(SUM(COALESCE(p.total_km,0)),0) FROM public.profiles p),
         (SELECT COALESCE(SUM(COALESCE(p.total_fp,0)),0) FROM public.profiles p),
         (SELECT MAX(l.created_at) FROM public.season_reset_logs l)
  FROM public.seasons s WHERE s.ended_at IS NULL ORDER BY s.number DESC LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_season()
RETURNS TABLE(new_season integer, users_affected integer, km_reset numeric,
              fp_reset numeric, duels_settled integer, team_challenges_settled integer,
              fp_refunded numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_cur RECORD; v_next integer;
  v_users integer; v_km numeric; v_fp numeric;
  v_duels integer := 0; v_teams integer := 0; v_refund numeric := 0;
  v_inv RECORD; v_ch RECORD; v_stake numeric; v_n integer;
BEGIN
  IF v_admin IS NULL OR NOT public.has_role(v_admin, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_cur FROM public.seasons WHERE ended_at IS NULL ORDER BY number DESC LIMIT 1 FOR UPDATE;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_SEASON'; END IF;

  -- 1) Clôture sécurisée des duels 1v1 : restitution des mises bloquées
  FOR v_inv IN
    SELECT * FROM public.challenge_invites
    WHERE status IN ('pending','accepted') FOR UPDATE
  LOOP
    IF COALESCE(v_inv.stake_fp,0) > 0 THEN
      UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_inv.stake_fp, updated_at = now()
        WHERE user_id = v_inv.challenger_id;
      v_refund := v_refund + v_inv.stake_fp;
      IF v_inv.status = 'accepted' THEN
        UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_inv.stake_fp, updated_at = now()
          WHERE user_id = v_inv.challenged_id;
        v_refund := v_refund + v_inv.stake_fp;
      END IF;
    END IF;
    UPDATE public.challenge_invites
      SET status = 'expired', responded_at = now(), coffre_amount = 0
      WHERE id = v_inv.id;
    v_duels := v_duels + 1;
  END LOOP;

  -- 2) Clôture sécurisée des défis d'équipe : restitution des mises bloquées
  FOR v_ch IN
    SELECT * FROM public.challenges WHERE status IN ('open','pending','active') FOR UPDATE
  LOOP
    v_stake := COALESCE(v_ch.stake_fp,0);
    IF v_stake > 0 THEN
      SELECT COUNT(*) INTO v_n FROM public.team_members
        WHERE team_id = v_ch.team_a_id AND status = 'accepted';
      UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_stake, updated_at = now()
        WHERE user_id IN (SELECT user_id FROM public.team_members WHERE team_id = v_ch.team_a_id AND status = 'accepted');
      v_refund := v_refund + (v_stake * COALESCE(v_n,0));
      IF v_ch.team_b_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_n FROM public.team_members
          WHERE team_id = v_ch.team_b_id AND status = 'accepted';
        UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + v_stake, updated_at = now()
          WHERE user_id IN (SELECT user_id FROM public.team_members WHERE team_id = v_ch.team_b_id AND status = 'accepted');
        v_refund := v_refund + (v_stake * COALESCE(v_n,0));
      END IF;
    END IF;
    UPDATE public.challenges SET status = 'cancelled', coffre_amount = 0, end_date = now()
      WHERE id = v_ch.id;
    v_teams := v_teams + 1;
  END LOOP;

  -- 3) Photo avant remise à zéro
  SELECT COUNT(*)::int, COALESCE(SUM(COALESCE(total_km,0)),0), COALESCE(SUM(COALESCE(total_fp,0)),0)
    INTO v_users, v_km, v_fp FROM public.profiles;

  -- 4) Remise à zéro de la progression (comptes et historiques conservés)
  UPDATE public.profiles SET
    total_km = 0, total_fp = 0, total_steps = 0, total_activities = 0,
    fp_base = 0, updated_at = now();

  -- 5) Nouvelle saison
  SELECT COALESCE(MAX(number),0) + 1 INTO v_next FROM public.seasons;
  UPDATE public.seasons SET ended_at = now() WHERE id = v_cur.id;
  INSERT INTO public.seasons (number, started_at, created_by) VALUES (v_next, now(), v_admin);

  -- 6) Journal
  INSERT INTO public.season_reset_logs
    (admin_id, season_from, season_to, users_affected, total_km_reset, total_fp_reset,
     duels_settled, team_challenges_settled, fp_refunded, result)
  VALUES (v_admin, v_cur.number, v_next, v_users, v_km, v_fp, v_duels, v_teams, v_refund, 'success');

  RETURN QUERY SELECT v_next, v_users, v_km, v_fp, v_duels, v_teams, v_refund;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_season() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_season_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_season_start() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_season() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_season_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_season_start() TO authenticated;