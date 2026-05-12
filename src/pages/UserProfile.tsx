import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Route, Flame, Trophy, Timer, ChevronLeft, UserPlus, UserMinus, Swords } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeDistance, setChallengeDistance] = useState(5);
  const [challengeLevel, setChallengeLevel] = useState<string>("ROOKIE I");
  const [challengeDate, setChallengeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });
  const [sending, setSending] = useState(false);

  const DUEL_LEVELS: { name: string; stake: number }[] = [
    { name: "ROOKIE I", stake: 5 },
    { name: "ROOKIE II", stake: 10 },
    { name: "ROOKIE III", stake: 15 },
    { name: "GUERRIER DES PAVÉS I", stake: 20 },
    { name: "GUERRIER DES PAVÉS II", stake: 25 },
    { name: "GUERRIER DES PAVÉS III", stake: 30 },
    { name: "MACHINE DE GUERRE I", stake: 40 },
    { name: "MACHINE DE GUERRE II", stake: 45 },
    { name: "MACHINE DE GUERRE III", stake: 50 },
    { name: "FREAK I", stake: 60 },
    { name: "FREAK II", stake: 65 },
    { name: "FREAK III", stake: 70 },
    { name: "FREAK MASTER", stake: 80 },
  ];
  const selectedStake = DUEL_LEVELS.find((l) => l.name === challengeLevel)?.stake ?? 5;

  useEffect(() => {
    if (profile) {
      const level = getLevel(profile.total_km || 0);
      setChallengeLevel(level.name);
    }
  }, [profile]);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id, user]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: prof }, { count: followers }, { count: following }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", id!).single(),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("following_id", id!),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", id!),
    ]);

    setProfile(prof);
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);

    // Check if current user follows this profile
    if (user && id) {
      const { count } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", user.id)
        .eq("following_id", id);
      setIsFollowing((count || 0) > 0);
    }

    // Get rank
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("user_id, total_km")
      .order("total_km", { ascending: false });
    if (allProfiles) {
      const idx = allProfiles.findIndex((p) => p.user_id === id);
      setRank(idx >= 0 ? idx + 1 : null);
    }

    setLoading(false);
  };

  const toggleFollow = async () => {
    if (!user || !id) return;
    if (isFollowing) {
      await supabase.from("followers").delete().eq("follower_id", user.id).eq("following_id", id);
      setIsFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("followers").insert({ follower_id: user.id, following_id: id });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  const totalKm = profile.total_km || 0;
  const level = getLevel(totalKm);

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Back button */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full overflow-hidden mb-3 neon-glow">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-primary flex items-center justify-center">
              <span className="font-display font-black text-2xl text-primary-foreground">
                {(profile.username || "R")[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <h1 className="font-display font-black text-2xl">{profile.username}</h1>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
          <MapPin className="w-3 h-3" />
          <span>{profile.country || "FR"}</span>
          {rank && <span className="ml-2 text-primary font-bold">#{rank}</span>}
        </div>

        {/* Follow counts */}
        <div className="flex items-center gap-6 mt-3">
          <div className="text-center">
            <p className="font-display font-bold text-lg">{followerCount}</p>
            <p className="text-[10px] text-muted-foreground">Abonnés</p>
          </div>
          <div className="text-center">
            <p className="font-display font-bold text-lg">{followingCount}</p>
            <p className="text-[10px] text-muted-foreground">Abonnements</p>
          </div>
        </div>

        <div className="mt-3">
          <LevelBadge totalKm={totalKm} size="lg" />
        </div>

        {/* Action buttons */}
        {user && user.id !== id && (
          <div className="flex gap-3 mt-4">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={toggleFollow}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-bold text-sm ${
                isFollowing
                  ? "bg-secondary text-secondary-foreground"
                  : "gradient-primary text-primary-foreground neon-glow"
              }`}
            >
              {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isFollowing ? "Se désabonner" : "Suivre"}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setChallengeOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-accent text-accent-foreground font-display font-bold text-sm accent-glow"
            >
              <Swords className="w-4 h-4" />
              Défier
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Route} label="Distance totale" value={Number(totalKm).toFixed(1)} unit="km" accent delay={0.1} />
        <StatCard icon={Trophy} label="Activités" value={profile.total_activities || 0} delay={0.15} />
        <StatCard icon={Flame} label="Freak Points" value={Number(profile.total_fp || 0).toFixed(1)} unit="FP" delay={0.2} />
        <StatCard icon={Timer} label="Pas totaux" value={(profile.total_steps || 0).toLocaleString()} delay={0.25} />
      </div>

      {/* Challenge Dialog */}
      <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Swords className="w-5 h-5 text-accent" /> Défier {profile.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Défi 1v1 sécurisé. Mise prélevée immédiatement et placée dans le coffre 🔒.
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Niveau du défi (mise FP obligatoire)</label>
              <div className="grid grid-cols-2 gap-2">
                {DUEL_LEVELS.map((l) => (
                  <button
                    key={l.name}
                    onClick={() => setChallengeLevel(l.name)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all ${
                      challengeLevel === l.name
                        ? "gradient-accent text-accent-foreground accent-glow"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {l.name}
                    <div className="text-[10px] opacity-80">{l.stake} FP</div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Mise actuelle : <span className="text-accent font-bold">{selectedStake} FP</span> · Coffre total après acceptation : <span className="text-primary font-bold">{selectedStake * 2} FP</span> · Frais plateforme : 1 FP · Vainqueur reçoit : <span className="text-primary font-bold">{selectedStake * 2 - 1} FP</span>
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Distance du défi</label>
              <div className="flex gap-2">
                {[3, 5, 7, 10].map((d) => (
                  <button
                    key={d}
                    onClick={() => setChallengeDistance(d)}
                    className={`flex-1 py-3 rounded-xl font-display font-bold text-sm transition-all ${
                      challengeDistance === d
                        ? "gradient-accent text-accent-foreground accent-glow"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {d} km
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Date du défi</label>
              <input
                type="datetime-local"
                value={challengeDate}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setChallengeDate(e.target.value)}
                className="w-full rounded-xl bg-secondary border border-border px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              disabled={sending}
              onClick={async () => {
                if (!user || !id) return;
                setSending(true);
                const { error } = await supabase.rpc("create_duel_invite" as any, {
                  p_challenged: id,
                  p_distance: challengeDistance,
                  p_level: challengeLevel,
                  p_scheduled: new Date(challengeDate).toISOString(),
                });
                if (error) {
                  toast.error(error.message || "Erreur lors de l'envoi");
                } else {
                  toast.success(`Défi envoyé ! ${selectedStake} FP prélevés 🔒`);
                  setChallengeOpen(false);
                }
                setSending(false);
              }}
              className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow disabled:opacity-50"
            >
              {sending ? "Envoi..." : `MISER ${selectedStake} FP & DÉFIER`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
