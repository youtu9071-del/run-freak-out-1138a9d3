
-- 1. Remove permissive UPDATE policies (all legit updates go through SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Challenged user can respond" ON public.challenge_invites;
DROP POLICY IF EXISTS "Users can update own participation" ON public.challenge_participations;
DROP POLICY IF EXISTS "Users can update their own results" ON public.challenge_results;
DROP POLICY IF EXISTS "Team members can update challenges" ON public.challenges;
DROP POLICY IF EXISTS "Users can update their participation" ON public.event_participants;
DROP POLICY IF EXISTS "Users can update their own membership" ON public.team_members;

-- 2. Replacement server-side operations
CREATE OR REPLACE FUNCTION public.accept_team_invite(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  UPDATE public.team_members
     SET status = 'accepted'
   WHERE team_id = p_team_id AND user_id = auth.uid() AND status = 'invited';
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.expire_duel_invites()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD;
BEGIN
  FOR inv IN
    SELECT id, challenger_id, stake_fp FROM public.challenge_invites
    WHERE status = 'pending' AND expires_at < now()
  LOOP
    UPDATE public.challenge_invites SET status = 'expired', responded_at = now() WHERE id = inv.id;
    IF COALESCE(inv.stake_fp, 0) > 0 THEN
      UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + inv.stake_fp, updated_at = now()
       WHERE user_id = inv.challenger_id;
    END IF;
  END LOOP;
END; $$;

-- 3. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, public;

-- callable by signed-in users (app flows)
GRANT EXECUTE ON FUNCTION
  public.has_role(uuid, app_role),
  public.accept_duel_invite(uuid),
  public.refuse_duel_invite(uuid),
  public.create_duel_invite(uuid, numeric, text, timestamptz),
  public.expire_duel_invites(),
  public.accept_team_invite(uuid),
  public.start_team_challenge(uuid, numeric, numeric, timestamptz),
  public.accept_team_challenge(uuid, uuid),
  public.finalize_team_challenge(uuid),
  public.submit_team_challenge_run(uuid, numeric, integer, numeric),
  public.expire_old_challenges(),
  public.expire_team_challenges(),
  public.cleanup_expired_events(),
  public.sync_event_progress(numeric),
  public.expire_old_qrcodes(),
  public.purchase_with_fp(uuid, numeric),
  public.scan_qrcode_lookup(text),
  public.scan_qrcode_validate(text),
  public.partner_scan_validate(text),
  public.claim_partner_invite(text),
  public.duel_level_stake(text)
TO authenticated;

-- public (pre-signup username check only)
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
