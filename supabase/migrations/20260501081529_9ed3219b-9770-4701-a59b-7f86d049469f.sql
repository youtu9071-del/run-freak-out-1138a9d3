ALTER TABLE public.challenge_invites REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_invites;