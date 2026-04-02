import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Flame, Route, Timer, Trophy, TrendingUp, Camera, LogOut, Medal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MOCK_LEADERBOARD, getLevel, LEVELS } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";
import BadgeUnlockOverlay from "@/components/BadgeUnlockOverlay";
import RecordNotification from "@/components/RecordNotification";
import { supabase } from "@/integrations/supabase/client";

export default function Profile() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showBadgeUnlock, setShowBadgeUnlock] = useState(false);
  const [record, setRecord] = useState<{ label: string; value: string } | null>(null);
  const [activeLeaderTab, setActiveLeaderTab] = useState("Global");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalKm = profile?.total_km || 0;
  const currentLevel = getLevel(totalKm);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProfileImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const triggerBadgeDemo = () => setShowBadgeUnlock(true);
  const triggerRecordDemo = () => {
    setRecord({ label: "Plus longue course", value: "12.3 km" });
    setTimeout(() => setRecord(null), 4000);
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <BadgeUnlockOverlay level={showBadgeUnlock ? currentLevel : null} onClose={() => setShowBadgeUnlock(false)} />
      <RecordNotification record={record} onClose={() => setRecord(null)} />

      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-6">
        <button onClick={() => fileInputRef.current?.click()} className="relative w-20 h-20 rounded-full overflow-hidden mb-3 neon-glow group">
          {profileImage ? (
            <img src={profileImage} alt="Profil" className="w-full h-full object-cover" />
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
        <div className="mt-3">
          <LevelBadge totalKm={totalKm} size="lg" />
        </div>
      </motion.div>

      {/* Demo + Logout */}
      <div className="flex gap-2 mb-6">
        <motion.button whileTap={{ scale: 0.95 }} onClick={triggerBadgeDemo} className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
          <Trophy className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-bold text-xs">Badge unlock</p>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={triggerRecordDemo} className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
          <TrendingUp className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="font-display font-bold text-xs">Record perso</p>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={signOut} className="flex-1 rounded-xl bg-card border border-destructive/30 p-3 text-center">
          <LogOut className="w-4 h-4 text-destructive mx-auto mb-1" />
          <p className="font-display font-bold text-xs text-destructive">Déconnexion</p>
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Route} label="Distance totale" value={totalKm.toFixed ? Number(totalKm).toFixed(1) : "0"} unit="km" accent delay={0.1} />
        <StatCard icon={Trophy} label="Activités" value={profile?.total_activities || 0} delay={0.15} />
        <StatCard icon={Flame} label="Freak Points" value={Number(profile?.total_fp || 0).toFixed(1)} unit="FP" delay={0.2} />
        <StatCard icon={Timer} label="Pas totaux" value={(profile?.total_steps || 0).toLocaleString()} delay={0.25} />
      </div>

      {/* Leaderboard Section */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Medal className="w-5 h-5 text-primary" />
            Classement 🏆
          </h2>
        </div>

        <div className="flex gap-2 mb-4">
          {["Global", "Semaine", "Saison"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveLeaderTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeLeaderTab === tab
                  ? "gradient-primary text-primary-foreground neon-glow"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Top 3 Podium */}
        <div className="flex items-end justify-center gap-3 mb-4">
          {[1, 0, 2].map((idx) => {
            const entry = MOCK_LEADERBOARD[idx];
            const isFirst = idx === 0;
            return (
              <div key={entry.rank} className="flex flex-col items-center">
                <div className={`rounded-full flex items-center justify-center font-display font-black mb-1 ${
                  isFirst ? "w-14 h-14 text-lg gradient-primary neon-glow-strong" : "w-10 h-10 text-sm bg-secondary"
                }`}>
                  {entry.username[0]}
                </div>
                <p className="font-display font-bold text-[10px]">{entry.username}</p>
                <p className="text-[9px] text-muted-foreground">{entry.totalKm} km</p>
                <div className={`mt-1 rounded-t-lg flex items-center justify-center font-display font-black ${
                  isFirst ? "w-14 h-20 gradient-primary text-primary-foreground text-base" :
                  idx === 1 ? "w-12 h-14 bg-secondary text-foreground text-sm" :
                  "w-12 h-10 bg-muted text-muted-foreground text-sm"
                }`}>
                  #{entry.rank}
                </div>
              </div>
            );
          })}
        </div>

        {/* List */}
        <div className="space-y-2">
          {MOCK_LEADERBOARD.slice(3, 8).map((entry, i) => {
            const isUser = entry.username === (profile?.username || "RunnerX");
            return (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className={`rounded-xl p-3 flex items-center gap-3 border ${
                  isUser ? "border-primary/30 bg-primary/5 neon-glow" : "border-border bg-card"
                }`}
              >
                <span className="font-display font-bold text-xs w-6 text-center text-muted-foreground">#{entry.rank}</span>
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-display font-bold text-xs">
                  {entry.username[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-xs truncate">
                    {entry.username}
                    {isUser && <span className="text-primary ml-1">(toi)</span>}
                  </p>
                  <p className="text-[9px] text-muted-foreground">{entry.level.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-xs">{entry.totalKm} km</p>
                  <p className="text-[9px] text-primary">{entry.totalPoints} pts</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
