CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL UNIQUE,
  rewarded boolean NOT NULL DEFAULT false,
  reward_fp numeric NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referee_id)
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own referrals" ON public.referrals FOR SELECT TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referee_id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.apply_referral_reward(p_referee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referrals%ROWTYPE; v_km numeric;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE referee_id = p_referee AND rewarded = false FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(distance_km),0) INTO v_km FROM public.user_activities
   WHERE user_id = p_referee AND integrity_status = 'clean';
  IF v_km < 5 THEN RETURN; END IF;
  UPDATE public.referrals SET rewarded = true, reward_fp = 2, rewarded_at = now() WHERE id = r.id;
  UPDATE public.profiles SET total_fp = COALESCE(total_fp,0) + 2, updated_at = now() WHERE user_id = r.referrer_id;
  INSERT INTO public.notifications(user_id,type,title,message,related_id)
  VALUES (r.referrer_id,'referral','🎁 +2 FP de parrainage','Ton filleul a validé 5 km de course.', r.id);
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_referral_reward(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.referral_on_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.apply_referral_reward(NEW.user_id); RETURN NULL; END $$;
CREATE TRIGGER trg_referral_on_activity AFTER INSERT ON public.user_activities
FOR EACH ROW EXECUTE FUNCTION public.referral_on_activity();

CREATE OR REPLACE FUNCTION public.set_referrer(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_ref uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT user_id INTO v_ref FROM public.profiles WHERE lower(username) = lower(trim(p_username)) LIMIT 1;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_ref = v_me THEN RAISE EXCEPTION 'SELF_REFERRAL'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = v_me) THEN RAISE EXCEPTION 'ALREADY_REFERRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id = v_me AND referee_id = v_ref) THEN RAISE EXCEPTION 'CIRCULAR_REFERRAL'; END IF;
  INSERT INTO public.referrals(referrer_id, referee_id) VALUES (v_ref, v_me);
  PERFORM public.apply_referral_reward(v_me);
  RETURN (SELECT username FROM public.profiles WHERE user_id = v_ref);
END $$;
REVOKE EXECUTE ON FUNCTION public.set_referrer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_referrer(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_referral_overview()
RETURNS TABLE(kind text, other_username text, other_avatar text, rewarded boolean, reward_fp numeric, km numeric, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN r.referrer_id = auth.uid() THEN 'referee' ELSE 'referrer' END,
         p.username, p.avatar_url, r.rewarded, r.reward_fp,
         LEAST(5, (SELECT COALESCE(SUM(a.distance_km),0) FROM public.user_activities a WHERE a.user_id = r.referee_id AND a.integrity_status = 'clean')),
         r.created_at
  FROM public.referrals r
  JOIN public.profiles p ON p.user_id = CASE WHEN r.referrer_id = auth.uid() THEN r.referee_id ELSE r.referrer_id END
  WHERE auth.uid() IN (r.referrer_id, r.referee_id)
  ORDER BY r.created_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.my_referral_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_overview() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;