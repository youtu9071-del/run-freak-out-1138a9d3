-- ============================================
-- 1. NOTIFICATIONS TABLE (for 1v1 challenge invites & general)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'challenge_invite',
  title TEXT NOT NULL,
  message TEXT,
  related_id UUID,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own notifications" ON public.notifications;
CREATE POLICY "Users see their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own notifications" ON public.notifications;
CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete their own notifications" ON public.notifications;
CREATE POLICY "Users delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "System inserts notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger to auto-create notification when a challenge_invite is inserted
CREATE OR REPLACE FUNCTION public.notify_challenge_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenger_name TEXT;
BEGIN
  SELECT username INTO challenger_name FROM public.profiles WHERE user_id = NEW.challenger_id;
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.challenged_id,
    'challenge_invite',
    'Nouveau défi reçu ⚔️',
    COALESCE(challenger_name, 'Un runner') || ' te défie sur ' || NEW.distance_km || ' km',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_challenge_invite ON public.challenge_invites;
CREATE TRIGGER trg_notify_challenge_invite
  AFTER INSERT ON public.challenge_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_invite();

-- ============================================
-- 2. PURCHASE QRCODES — public lookup ID
-- ============================================
ALTER TABLE public.purchase_qrcodes
  ADD COLUMN IF NOT EXISTS qr_uid TEXT UNIQUE;

-- Backfill existing rows
UPDATE public.purchase_qrcodes
  SET qr_uid = replace(id::text, '-', '')
  WHERE qr_uid IS NULL;

-- Default for new rows
ALTER TABLE public.purchase_qrcodes
  ALTER COLUMN qr_uid SET DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Add expires_at if missing (should already exist)
ALTER TABLE public.purchase_qrcodes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days');

-- Public scan RPC — anyone can call to look up by uid; only returns safe info
CREATE OR REPLACE FUNCTION public.scan_qrcode_lookup(p_uid TEXT)
RETURNS TABLE (
  id UUID,
  qr_uid TEXT,
  status TEXT,
  product_name TEXT,
  buyer_name TEXT,
  fp_used NUMERIC,
  discount_amount NUMERIC,
  total_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.qr_uid, q.status,
         p.name, pr.username,
         q.fp_used, q.discount_amount, q.total_price,
         q.created_at, q.used_at, q.expires_at
  FROM public.purchase_qrcodes q
  LEFT JOIN public.products p ON p.id = q.product_id
  LEFT JOIN public.profiles pr ON pr.user_id = q.user_id
  WHERE q.qr_uid = p_uid;
END;
$$;

-- Validate (mark used) — admin only via has_role check, returns updated row
CREATE OR REPLACE FUNCTION public.scan_qrcode_validate(p_uid TEXT)
RETURNS TABLE (
  status TEXT,
  already_used BOOLEAN,
  used_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_used_at TIMESTAMP WITH TIME ZONE;
  v_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can validate QR codes';
  END IF;

  SELECT q.id, q.status, q.used_at INTO v_id, v_status, v_used_at
  FROM public.purchase_qrcodes q WHERE q.qr_uid = p_uid;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT, false, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  IF v_status = 'used' THEN
    RETURN QUERY SELECT 'used'::TEXT, true, v_used_at;
    RETURN;
  END IF;

  UPDATE public.purchase_qrcodes
    SET status = 'used', used_at = now(), scanned_by = auth.uid()
    WHERE id = v_id;

  RETURN QUERY SELECT 'used'::TEXT, false, now();
END;
$$;

-- ============================================
-- 3. TEAMS — allow creator to delete & allow inviting members
-- ============================================
DROP POLICY IF EXISTS "Creators can delete their team" ON public.teams;
CREATE POLICY "Creators can delete their team"
  ON public.teams FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- Allow the team creator to invite new members at any time
DROP POLICY IF EXISTS "Team creator can invite members" ON public.team_members;
CREATE POLICY "Team creator can invite members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.creator_id = auth.uid())
  );

-- Allow team creator to remove members (cleanup on team delete or kick)
DROP POLICY IF EXISTS "Team creator can remove members" ON public.team_members;
CREATE POLICY "Team creator can remove members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.creator_id = auth.uid())
  );

-- ============================================
-- 4. CHALLENGES — auto-mark completed when end_date passed
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_old_challenges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.challenges
    SET status = 'completed'
    WHERE status = 'active'
      AND end_date IS NOT NULL
      AND end_date < now();
END;
$$;
