import { motion } from "framer-motion";
import { Play, Flame, Route, Timer, Zap, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getLevel } from "@/lib/gamification";
import { useAuth } from "@/contexts/AuthContext";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  const totalKm = profile?.total_km || 0;
  const totalFp = profile?.total_fp || 0;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_activities")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setRecentActivities(data);
      });
  }, [user]);

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <p className="text-sm text-muted-foreground">Salut,</p>
          <h1 className="font-display font-black text-2xl text-foreground">
            {profile?.username || "Runner"} 🔥
          </h1>
        </div>
        <LevelBadge totalKm={totalKm} size="sm" />
      </motion.div>

      {/* Start Run Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/activity")}
        className="w-full rounded-2xl gradient-primary p-6 flex items-center justify-between mb-6 neon-glow-strong animate-pulse-neon"
      >
        <div className="text-left">
          <p className="font-display font-black text-xl text-primary-foreground">
            LANCER UNE COURSE
          </p>
          <p className="text-sm text-primary-foreground/70 mt-1">
            {totalKm.toFixed(1)} km parcourus 🔥
          </p>
        </div>
        <div className="w-14 h-14 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <Play className="w-7 h-7 text-primary-foreground ml-1" />
        </div>
      </motion.button>

      {/* Challenge Card */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate("/challenges")}
        className="w-full rounded-2xl gradient-accent p-5 flex items-center gap-4 mb-6 accent-glow"
      >
        <Swords className="w-8 h-8 text-accent-foreground" />
        <div className="text-left">
          <p className="font-display font-bold text-lg text-accent-foreground">DÉFIS</p>
          <p className="text-xs text-accent-foreground/70">Affronte des adversaires de ton niveau</p>
        </div>
      </motion.button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Route} label="Distance totale" value={Number(totalKm).toFixed(1)} unit="km" accent delay={0.2} />
        <StatCard icon={Zap} label="Freak Points" value={Number(totalFp).toFixed(1)} unit="FP" delay={0.25} />
        <StatCard icon={Flame} label="Activités" value={profile?.total_activities || 0} delay={0.3} />
        <StatCard icon={Timer} label="Pas totaux" value={(profile?.total_steps || 0).toLocaleString()} delay={0.35} />
      </div>

      {/* Recent Activities */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h2 className="font-display font-bold text-lg mb-3">Activités récentes</h2>
        <div className="space-y-2">
          {recentActivities.length === 0 ? (
            <div className="rounded-xl bg-card border border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Aucune activité</p>
              <p className="text-xs text-muted-foreground mt-1">Lance ta première course !</p>
            </div>
          ) : (
            recentActivities.map((act) => (
              <div key={act.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
                <div>
                  <p className="font-display font-semibold text-sm">{Number(act.distance_km).toFixed(2)} km</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(act.created_at).toLocaleDateString("fr-FR")} · {Math.round(act.duration_seconds / 60)} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">+{Number(act.total_fp).toFixed(1)} FP</p>
                  <p className="text-xs text-muted-foreground">{Number(act.avg_speed).toFixed(1)} km/h</p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
