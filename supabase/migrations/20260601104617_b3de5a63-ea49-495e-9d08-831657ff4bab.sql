CREATE POLICY "Admins can delete challenges" ON public.challenges FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete challenge invites" ON public.challenge_invites FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete participations" ON public.challenge_participations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
GRANT DELETE ON public.challenges TO authenticated;
GRANT DELETE ON public.challenge_participations TO authenticated;