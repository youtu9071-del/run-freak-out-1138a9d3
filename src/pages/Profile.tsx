import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Flame, Route, Timer, Trophy, Camera, LogOut, Shield, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel, getLevelProgress, LEVELS } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import ChallengeInvites from "@/components/ChallengeInvites";
import NotificationsBell from "@/components/NotificationsBell";

export default function Profile() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  const totalKm = Number(profile?.total_km || 0);
  const level = getLevel(totalKm);
  const progress = getLevelProgress(totalKm);
  const nextLevel = LEVELS[Math.min(level.tier, LEVELS.length - 1)];
  const kmToNext = level.maxKm === Infinity ? 0 : Math.max(0, level.maxKm + 1 - totalKm);

  const particles = useMemo(
    () =>
      Array.from({ length: 14 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5,
      })),
    []
  );

  useEffect(() => {
    if (user) fetchFollowCounts();
  }, [user]);

  const fetchFollowCounts = async () => {
    if (!user) return;
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
    ]);
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user.id);
    await refreshProfile();
    setUploading(false);
  };

  const stats = [
    { icon: Route, label: "Distance", value: totalKm.toFixed(1), unit: "km", color: "text-primary" },
    { icon: Flame, label: "Freak Points", value: Number(profile?.total_fp || 0).toFixed(1), unit: "FP", color: "text-accent" },
    { icon: Trophy, label: "Activités", value: String(profile?.total_activities || 0), unit: "", color: "text-primary" },
    { icon: Timer, label: "Pas totaux", value: (profile?.total_steps || 0).toLocaleString(), unit: "", color: "text-accent" },
  ];

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto relative overflow-x-hidden px-3 sm:px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Ambient background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-80 gradient-hero pointer-events-none -z-10 opacity-70" />
      <div className="absolute inset-0 pointer-events-none -z-10">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary/40"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -22, 0], opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      <NotificationsBell />

      {/* Hero card : avatar + niveau + progression */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl border border-border/60 bg-card/70 backdrop-blur-md p-5 mb-4 overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle at 20% 0%, ${level.color}, transparent 60%)` }}
        />

        <div className="relative flex items-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden neon-glow group shrink-0"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full gradient-primary flex items-center justify-center">
                <span className="font-display font-black text-3xl text-primary-foreground">
                  {(profile?.username || "R")[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-foreground" />
            </div>
            {uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-black text-xl sm:text-2xl truncate">
              {profile?.username || "Runner"}
            </h1>
            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
              <MapPin className="w-3 h-3" /> <span>{profile?.country || "FR"}</span>
            </div>
            <button
              onClick={() => navigate("/levels")}
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-display font-black uppercase tracking-widest active:scale-95 transition-transform"
              style={{ backgroundColor: `${level.color}22`, color: level.color, border: `1px solid ${level.color}55` }}
            >
              <Sparkles className="w-3 h-3" /> {level.name}
            </button>
          </div>
        </div>

        {/* Follow counts */}
        <div className="relative flex items-center justify-around mt-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <p className="font-display font-black text-lg">{followerCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Abonnés</p>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-center">
            <p className="font-display font-black text-lg">{followingCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Abonnements</p>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-center">
            <p className="font-display font-black text-lg text-accent">{Number(profile?.total_fp || 0).toFixed(0)}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">FP</p>
          </div>
        </div>

        {/* Progression du niveau */}
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Progression
            </span>
            <span className="font-display font-black" style={{ color: level.color }}>
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-secondary/70 overflow-hidden relative">
            <motion.div
              className="h-full rounded-full relative"
              style={{ background: `linear-gradient(90deg, ${level.color}, hsl(var(--primary)))` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute inset-0 shimmer opacity-40" />
            </motion.div>
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
            <span>{totalKm.toFixed(1)} km</span>
            {level.maxKm === Infinity ? (
              <span className="text-accent font-bold">🏆 Rang maximum atteint</span>
            ) : (
              <span>
                <span className="text-primary font-bold">{kmToNext.toFixed(1)} km</span> avant{" "}
                <span className="font-bold" style={{ color: nextLevel.color }}>{nextLevel.name}</span>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Grand badge Rank */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate("/levels")}
        className="w-full rounded-3xl border border-border/60 bg-card/70 backdrop-blur-md p-5 mb-4 flex items-center gap-4 text-left"
      >
        <div className="shrink-0"><LevelBadge totalKm={totalKm} size="lg" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-primary font-black">Rang actuel</p>
          <p className="font-display font-black text-base truncate">{level.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Voir tous les rangs →</p>
        </div>
        <Zap className="w-5 h-5 text-accent shrink-0" />
      </motion.button>

      {/* Next milestone card */}
      {level.maxKm !== Infinity && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/70 to-accent/10 backdrop-blur-md p-4 mb-4 overflow-hidden"
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-primary font-black mb-1">
                🎯 Prochain palier
              </p>
              <p className="font-display font-black text-base truncate" style={{ color: nextLevel.color }}>
                {nextLevel.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Encore <span className="font-bold text-foreground">{kmToNext.toFixed(1)} km</span> à parcourir
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display font-black text-3xl text-gradient-primary">
                {progress.toFixed(0)}<span className="text-sm">%</span>
              </p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Complété</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Challenge Invites */}
      <ChallengeInvites />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-4 relative overflow-hidden"
          >
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-primary/5 blur-xl" />
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <p className="font-display font-black text-xl text-foreground truncate">
              {s.value}
              {s.unit && <span className="text-xs text-muted-foreground ml-1">{s.unit}</span>}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
              {s.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Admin */}
      {isAdmin && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/admin")}
          className="w-full rounded-2xl bg-primary/10 border border-primary/30 p-3.5 text-center mb-3 flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4 text-primary" />
          <p className="font-display font-bold text-xs text-primary uppercase tracking-widest">Panel Admin</p>
        </motion.button>
      )}

      {/* Logout */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={signOut}
        className="w-full rounded-2xl bg-card/70 backdrop-blur-md border border-destructive/30 p-3.5 text-center flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4 text-destructive" />
        <p className="font-display font-bold text-xs text-destructive uppercase tracking-widest">Déconnexion</p>
      </motion.button>
    </div>
  );
}
