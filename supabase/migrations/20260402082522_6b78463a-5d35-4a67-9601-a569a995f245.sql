
-- Create enums
CREATE TYPE public.gender_type AS ENUM ('homme', 'femme');
CREATE TYPE public.fitness_level AS ENUM ('debutant', 'intermediaire', 'avance', 'pro');
CREATE TYPE public.fitness_goal AS ENUM ('perdre_poids', 'endurance', 'performance', 'bien_etre');
CREATE TYPE public.member_status AS ENUM ('invited', 'accepted');
CREATE TYPE public.challenge_status AS ENUM ('pending', 'active', 'completed');
CREATE TYPE public.integrity_status AS ENUM ('clean', 'suspect', 'fraud');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  country TEXT DEFAULT 'FR',
  gender public.gender_type,
  fitness_level public.fitness_level,
  goal public.fitness_goal,
  onboarding_completed BOOLEAN DEFAULT false,
  total_km NUMERIC DEFAULT 0,
  total_fp NUMERIC DEFAULT 0,
  total_steps BIGINT DEFAULT 0,
  total_activities INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Runner' || substr(NEW.id::text, 1, 4)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User activities
CREATE TABLE public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  steps INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  avg_speed NUMERIC DEFAULT 0,
  calories INTEGER DEFAULT 0,
  fp_from_km NUMERIC DEFAULT 0,
  fp_from_steps NUMERIC DEFAULT 0,
  total_fp NUMERIC DEFAULT 0,
  integrity_status public.integrity_status DEFAULT 'clean',
  gps_points JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activities" ON public.user_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own activities" ON public.user_activities FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their team" ON public.teams FOR UPDATE USING (auth.uid() = creator_id);

-- Team members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.member_status DEFAULT 'invited',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members viewable by all authenticated" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert team members" ON public.team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = invited_by);
CREATE POLICY "Users can update their own membership" ON public.team_members FOR UPDATE TO authenticated USING (auth.uid() = user_id OR auth.uid() = invited_by);
CREATE POLICY "Users can leave teams" ON public.team_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Challenges
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_a_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  team_b_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 5,
  status public.challenge_status DEFAULT 'pending',
  time_limit_hours INTEGER DEFAULT 24,
  winner_team_id UUID REFERENCES public.teams(id),
  team_a_avg_time NUMERIC,
  team_b_avg_time NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenges viewable by all authenticated" ON public.challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create challenges" ON public.challenges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Participants can update challenges" ON public.challenges FOR UPDATE TO authenticated USING (true);

-- Challenge results
CREATE TABLE public.challenge_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  time_seconds INTEGER,
  distance_km NUMERIC,
  freak_points NUMERIC DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.challenge_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challenge results viewable by all authenticated" ON public.challenge_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own results" ON public.challenge_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own results" ON public.challenge_results FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Helper function for team member count
CREATE OR REPLACE FUNCTION public.get_team_member_count(p_team_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.team_members WHERE team_id = p_team_id AND status = 'accepted';
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
