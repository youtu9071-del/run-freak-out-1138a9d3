
-- Drop overly permissive policies
DROP POLICY "Authenticated users can create challenges" ON public.challenges;
DROP POLICY "Participants can update challenges" ON public.challenges;

-- Helper function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(p_user_id UUID, p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members WHERE user_id = p_user_id AND team_id = p_team_id AND status = 'accepted'
  );
$$;

-- Proper challenge policies
CREATE POLICY "Team members can create challenges" ON public.challenges FOR INSERT TO authenticated WITH CHECK (
  public.is_team_member(auth.uid(), team_a_id)
);
CREATE POLICY "Team members can update challenges" ON public.challenges FOR UPDATE TO authenticated USING (
  public.is_team_member(auth.uid(), team_a_id) OR public.is_team_member(auth.uid(), team_b_id)
);
