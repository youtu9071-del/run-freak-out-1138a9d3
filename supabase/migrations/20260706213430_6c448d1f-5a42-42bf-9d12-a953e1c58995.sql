
-- ============ FUNCTION EXECUTE HARDENING ============
-- Revoke default execute from public/anon on sensitive SECURITY DEFINER funcs;
-- grant execute to authenticated only where the app needs it.

DO $$
DECLARE
  fn text;
  app_fns text[] := ARRAY[
    'has_role(uuid, app_role)',
    'purchase_with_fp(uuid, numeric)',
    'scan_qrcode_lookup(text)',
    'scan_qrcode_validate(text)',
    'partner_scan_validate(text)',
    'create_duel_invite(uuid, numeric, text, timestamp with time zone)',
    'accept_duel_invite(uuid)',
    'refuse_duel_invite(uuid)',
    'finalize_duel(uuid, uuid)',
    'start_team_challenge(uuid, numeric, numeric, timestamp with time zone)',
    'accept_team_challenge(uuid, uuid)',
    'submit_team_challenge_run(uuid, numeric, integer, numeric)',
    'finalize_team_challenge(uuid)',
    'cleanup_expired_events()',
    'duel_level_stake(text)',
    'get_team_member_count(uuid)',
    'is_team_member(uuid, uuid)'
  ];
  internal_fns text[] := ARRAY[
    'handle_new_user()',
    'notify_challenge_invite()',
    'notify_team_invite()',
    'snapshot_event_on_join()',
    'update_updated_at_column()',
    'validate_team_challenge_distance()',
    'enforce_team_creation_level()',
    'update_profile_stats(uuid)',
    'expire_old_challenges()',
    'expire_old_qrcodes()',
    'expire_team_challenges()'
  ];
BEGIN
  FOREACH fn IN ARRAY app_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', fn);
  END LOOP;
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

-- ============ challenge_participations SELECT scoping ============
DROP POLICY IF EXISTS "Participations viewable by all authenticated" ON public.challenge_participations;
CREATE POLICY "View participations in own challenges"
  ON public.challenge_participations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_participations.challenge_id
        AND (
          public.is_team_member(auth.uid(), c.team_a_id)
          OR (c.team_b_id IS NOT NULL AND public.is_team_member(auth.uid(), c.team_b_id))
        )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============ challenge_results SELECT scoping ============
DROP POLICY IF EXISTS "Challenge results viewable by all authenticated" ON public.challenge_results;
CREATE POLICY "View own challenge results"
  ON public.challenge_results FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ event_participants SELECT scoping ============
DROP POLICY IF EXISTS "Participants viewable by authenticated" ON public.event_participants;
CREATE POLICY "View own event participation"
  ON public.event_participants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ team_members SELECT scoping ============
DROP POLICY IF EXISTS "Team members viewable by all authenticated" ON public.team_members;
CREATE POLICY "View team members of own teams"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR invited_by = auth.uid()
    OR public.is_team_member(auth.uid(), team_id)
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.creator_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============ team_members INSERT restriction (remove open self-insert) ============
DROP POLICY IF EXISTS "Users can insert team members" ON public.team_members;
-- "Team creator can invite members" policy already restricts inserts properly.

-- ============ notifications INSERT restriction (no more WITH CHECK true) ============
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
-- Cross-user notifications are created by SECURITY DEFINER triggers/functions
-- (notify_challenge_invite, notify_team_invite, finalize_* etc.) which bypass RLS.

-- ============ user_roles INSERT: prevent self-assignment ============
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can assign roles to others"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND user_id <> auth.uid()
  );

CREATE POLICY "Admins can update roles of others"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- ============ storage.objects: remove public listing on public buckets ============
-- Public buckets serve files via public URLs without needing SELECT policies.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
