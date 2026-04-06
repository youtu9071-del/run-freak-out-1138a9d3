
-- Create challenge invite status enum
CREATE TYPE public.challenge_invite_status AS ENUM ('pending', 'accepted', 'refused', 'expired');

-- Create challenge_invites table
CREATE TABLE public.challenge_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  challenged_id uuid NOT NULL,
  distance_km numeric NOT NULL DEFAULT 5,
  status challenge_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '3 days'),
  responded_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.challenge_invites ENABLE ROW LEVEL SECURITY;

-- Everyone can see invites that concern them
CREATE POLICY "Users can view their invites"
ON public.challenge_invites FOR SELECT
TO authenticated
USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Users can create invites
CREATE POLICY "Users can create invites"
ON public.challenge_invites FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = challenger_id);

-- Challenged user can update (accept/refuse)
CREATE POLICY "Challenged user can respond"
ON public.challenge_invites FOR UPDATE
TO authenticated
USING (auth.uid() = challenged_id);

-- Users can delete their expired invites
CREATE POLICY "Users can delete their invites"
ON public.challenge_invites FOR DELETE
TO authenticated
USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
