CREATE OR REPLACE FUNCTION public.admin_reset_season()
 RETURNS TABLE(new_season integer, users_affected integer, km_reset numeric, fp_reset numeric, duels_settled integer, team_challenges_settled integer, fp_refunded numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT COUNT(*)::int, COALESCE(SUM(COALESCE(total_km,0)),0), COALESCE(SUM(COALESCE(total_fp,0)),0)
    INTO v_users, v_km, v_fp FROM public.profiles;

  UPDATE public.profiles SET
    total_km = 0, total_fp = 0, total_steps = 0, total_activities = 0,
    fp_base = 0, updated_at = now()
  WHERE user_id IS NOT NULL;

  SELECT COALESCE(MAX(number),0) + 1 INTO v_next FROM public.seasons;
  UPDATE public.seasons SET ended_at = now() WHERE id = v_cur.id;
  INSERT INTO public.seasons (number, started_at, created_by) VALUES (v_next, now(), v_admin);

  INSERT INTO public.season_reset_logs
    (admin_id, season_from, season_to, users_affected, total_km_reset, total_fp_reset,
     duels_settled, team_challenges_settled, fp_refunded, result)
  VALUES (v_admin, v_cur.number, v_next, v_users, v_km, v_fp, v_duels, v_teams, v_refund, 'success');

  RETURN QUERY SELECT v_next, v_users, v_km, v_fp, v_duels, v_teams, v_refund;
END;
$function$;