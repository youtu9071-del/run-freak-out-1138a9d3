import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Flame, Route, Timer, Trophy, Camera, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [uploading, setUploading] = useState(false);

  const totalKm = profile?.total_km || 0;

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

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-6">
        <button onClick={() => fileInputRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden mb-3 neon-glow group">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profil" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-primary flex items-center justify-center">
              <span className="font-display font-black text-2xl text-primary-foreground">
                {(profile?.username || "R")[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-foreground" />
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </button>

        <h1 className="font-display font-black text-2xl">{profile?.username || "Runner"}</h1>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
          <MapPin className="w-3 h-3" />
          <span>{profile?.country || "FR"}</span>
        </div>

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
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Route} label="Distance totale" value={Number(totalKm).toFixed(1)} unit="km" accent delay={0.1} />
        <StatCard icon={Trophy} label="Activités" value={profile?.total_activities || 0} delay={0.15} />
        <StatCard icon={Flame} label="Freak Points" value={Number(profile?.total_fp || 0).toFixed(1)} unit="FP" delay={0.2} />
        <StatCard icon={Timer} label="Pas totaux" value={(profile?.total_steps || 0).toLocaleString()} delay={0.25} />
      </div>

      {/* Logout */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={signOut}
        className="w-full rounded-xl bg-card border border-destructive/30 p-3 text-center"
      >
        <div className="flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4 text-destructive" />
          <p className="font-display font-bold text-xs text-destructive">Déconnexion</p>
        </div>
      </motion.button>
    </div>
  );
}
