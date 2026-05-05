-- Trigger: notify user when they are invited to a team
CREATE OR REPLACE FUNCTION public.notify_team_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inviter_name TEXT;
  team_name TEXT;
BEGIN
  IF NEW.status = 'invited' AND NEW.user_id <> NEW.invited_by THEN
    SELECT username INTO inviter_name FROM public.profiles WHERE user_id = NEW.invited_by;
    SELECT name INTO team_name FROM public.teams WHERE id = NEW.team_id;
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (
      NEW.user_id,
      'team_invite',
      'Invitation à une équipe 👥',
      COALESCE(inviter_name, 'Quelqu''un') || ' t''invite à rejoindre « ' || COALESCE(team_name, 'une équipe') || ' »',
      NEW.team_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_invite_notify ON public.team_members;
CREATE TRIGGER team_invite_notify
AFTER INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.notify_team_invite();

-- Also attach challenge invite trigger if missing
DROP TRIGGER IF EXISTS challenge_invite_notify ON public.challenge_invites;
CREATE TRIGGER challenge_invite_notify
AFTER INSERT ON public.challenge_invites
FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_invite();