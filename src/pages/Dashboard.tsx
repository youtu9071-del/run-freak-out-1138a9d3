import { motion } from "framer-motion";
import {
  Play,
  Flame,
  Route,
  Timer,
  Zap,
  Swords,
  TrendingUp,
  ChevronRight,
  Trophy,
  Gift,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
    <div className="min-h-screen w-full max-w-lg mx-auto relative overflow-x-hidden px-3 sm:px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Ambient hero glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-80 gradient-hero pointer-events-none -z-10" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5 sm:mb-7 gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-primary font-bold uppercase tracking-[0.28em] truncate">
            FREAK OUT
          </p>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-foreground leading-tight mt-0.5 truncate">
            {profile?.username || "Runner"}
            <span className="text-gradient-primary">.</span>
          </h1>
        </div>
        <button
          onClick={() => navigate("/profile")}
          className="transition-transform active:scale-95 shrink-0"
          aria-label="Voir le profil"
        >
          <LevelBadge totalKm={totalKm} size="sm" />
        </button>
      </motion.div>

      {/* Hero CTA — Lancer une course */}
      <motion.button
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        whileTap={{ scale: 0.97 }}
        onClick={() => navigate("/activity")}
        className="relative w-full rounded-2xl gradient-primary p-4 sm:p-6 flex items-center justify-between gap-3 mb-4 shadow-premium overflow-hidden group"
      >
        {/* Decorative orbs */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-6 -bottom-10 w-28 h-28 rounded-full bg-white/5 blur-xl" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay shimmer" />

        <div className="text-left relative z-10 min-w-0 flex-1">
          <p className="text-[10px] font-bold text-primary-foreground/70 uppercase tracking-[0.18em] mb-1">
            Prêt à courir
          </p>
          <p className="font-display font-black text-xl sm:text-2xl text-primary-foreground leading-none break-words">
            LANCER UNE COURSE
          </p>
          <p className="text-[11px] sm:text-xs text-primary-foreground/80 mt-2 flex items-center gap-1.5 font-medium">
            <TrendingUp className="w-3 h-3 shrink-0" />
            {totalKm.toFixed(1)} km parcourus
          </p>
        </div>
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-primary-foreground/20 animate-ping" />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary-foreground/25 backdrop-blur-sm flex items-center justify-center ring-2 ring-primary-foreground/30">
            <Play className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground ml-1 fill-current" />
          </div>
        </div>
      </motion.button>

      {/* Bento Grid */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        {/* Défis — large tile */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/challenges")}
          className="col-span-2 row-span-2 relative overflow-hidden rounded-2xl gradient-accent p-4 text-left accent-glow group"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15 blur-2xl" />
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="w-11 h-11 rounded-xl bg-accent-foreground/15 backdrop-blur-sm flex items-center justify-center">
              <Swords className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="font-display font-black text-xl text-accent-foreground leading-tight">
                DÉFIS
              </p>
              <p className="text-[11px] text-accent-foreground/80 mt-1 font-medium">
                Affronte des adversaires de ton niveau
              </p>
              <div className="flex items-center gap-1 mt-2 text-accent-foreground/90 text-xs font-bold">
                <span>Voir</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </motion.button>

        {/* Distance */}
        <div className="col-span-2">
          <StatCard
            icon={Route}
            label="Distance"
            value={Number(totalKm).toFixed(1)}
            unit="km"
            accent
            delay={0.2}
          />
        </div>

        {/* Freak Points */}
        <div className="col-span-2">
          <StatCard
            icon={Zap}
            label="Freak Points"
            value={Number(totalFp).toFixed(1)}
            unit="FP"
            delay={0.25}
          />
        </div>

        {/* Activités */}
        <div className="col-span-2">
          <StatCard
            icon={Flame}
            label="Activités"
            value={profile?.total_activities || 0}
            delay={0.3}
          />
        </div>

        {/* Pas totaux */}
        <div className="col-span-2">
          <StatCard
            icon={Timer}
            label="Pas totaux"
            value={(profile?.total_steps || 0).toLocaleString()}
            delay={0.35}
          />
        </div>
      </div>

      {/* Quick actions row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3 mb-6"
      >
        <button
          onClick={() => navigate("/levels")}
          className="premium-card p-3 flex items-center gap-2.5 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm leading-tight">Rangs</p>
            <p className="text-[10px] text-muted-foreground truncate">Ta progression</p>
          </div>
        </button>
        <button
          onClick={() => navigate("/rewards")}
          className="premium-card p-3 flex items-center gap-2.5 text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
            <Gift className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm leading-tight">Récompenses</p>
            <p className="text-[10px] text-muted-foreground truncate">Échange tes FP</p>
          </div>
        </button>
      </motion.div>

      {/* Recent Activities */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-black text-lg tracking-tight">
            Activités récentes
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Dernières
          </span>
        </div>
        <div className="space-y-2">
          {recentActivities.length === 0 ? (
            <div className="premium-card p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
                <Play className="w-5 h-5 text-primary ml-0.5" />
              </div>
              <p className="text-sm font-display font-bold text-foreground">
                Aucune activité
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Lance ta première course pour démarrer !
              </p>
            </div>
          ) : (
            recentActivities.map((act, i) => (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="premium-card p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Route className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-sm">
                      {Number(act.distance_km).toFixed(2)} km
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(act.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {Math.round(act.duration_seconds / 60)} min
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-display font-black text-gradient-primary">
                    +{Number(act.total_fp).toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    {Number(act.avg_speed).toFixed(1)} km/h
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
