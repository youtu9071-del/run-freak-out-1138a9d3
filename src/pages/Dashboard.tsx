import { motion } from "framer-motion";
import { Play, Flame, Route, Timer, Zap, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MOCK_USER, MOCK_ACTIVITIES, getLevel } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";

export default function Dashboard() {
  const navigate = useNavigate();
  const level = getLevel(MOCK_USER.totalKm);

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
            {MOCK_USER.username} 🔥
          </h1>
        </div>
        <LevelBadge totalKm={MOCK_USER.totalKm} size="sm" />
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
            Série actuelle : {MOCK_USER.streak} jours 🔥
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
        onClick={() => navigate("/challenge")}
        className="w-full rounded-2xl gradient-accent p-5 flex items-center gap-4 mb-6 accent-glow"
      >
        <Swords className="w-8 h-8 text-accent-foreground" />
        <div className="text-left">
          <p className="font-display font-bold text-lg text-accent-foreground">DÉFI 1v1</p>
          <p className="text-xs text-accent-foreground/70">Affronte un adversaire de ton niveau</p>
        </div>
      </motion.button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Route} label="Distance totale" value={MOCK_USER.totalKm.toFixed(1)} unit="km" accent delay={0.2} />
        <StatCard icon={Zap} label="Points" value={MOCK_USER.totalPoints} delay={0.25} />
        <StatCard icon={Flame} label="Calories brûlées" value={MOCK_USER.totalCalories.toLocaleString()} unit="kcal" delay={0.3} />
        <StatCard icon={Timer} label="Meilleur pace" value={MOCK_USER.bestPace.toFixed(1)} unit="min/km" delay={0.35} />
      </div>

      {/* Recent Activities */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h2 className="font-display font-bold text-lg mb-3">Activités récentes</h2>
        <div className="space-y-2">
          {MOCK_ACTIVITIES.slice(0, 3).map((act) => (
            <div key={act.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm">{act.distanceKm} km</p>
                <p className="text-xs text-muted-foreground">{act.date} · {act.durationMin} min</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">+{act.points} pts</p>
                <p className="text-xs text-muted-foreground">{act.avgSpeed.toFixed(1)} km/h</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
