ALTER TABLE public.challenge_invites
ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP WITH TIME ZONE;