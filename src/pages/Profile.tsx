import { motion } from "framer-motion";
import { MapPin, Flame, Route, Timer, Trophy, TrendingUp } from "lucide-react";
import { MOCK_USER, MOCK_ACTIVITIES } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";

export default function Profile() {
  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-8"
      >
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-3 neon-glow">
          <span className="font-display font-black text-2xl text-primary-foreground">
            {MOCK_USER.username[0]}
          </span>
        </div>
        <h1 className="font-display font-black text-2xl">{MOCK_USER.username}</h1>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
          <MapPin className="w-3 h-3" />
          <span>{MOCK_USER.country}</span>
        </div>
        <div className="mt-4">
          <LevelBadge totalKm={MOCK_USER.totalKm} size="lg" />
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Route} label="Distance totale" value={MOCK_USER.totalKm.toFixed(1)} unit="km" accent delay={0.1} />
        <StatCard icon={Trophy} label="Courses" value={MOCK_USER.totalRuns} delay={0.15} />
        <StatCard icon={Flame} label="Calories" value={MOCK_USER.totalCalories.toLocaleString()} unit="kcal" delay={0.2} />
        <StatCard icon={Timer} label="Meilleur pace" value={MOCK_USER.bestPace.toFixed(1)} unit="min/km" delay={0.25} />
        <StatCard icon={TrendingUp} label="Plus longue course" value={MOCK_USER.longestRun.toFixed(1)} unit="km" delay={0.3} />
        <StatCard icon={Flame} label="Série actuelle" value={MOCK_USER.streak} unit="jours" delay={0.35} />
      </div>

      {/* Activity History */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h2 className="font-display font-bold text-lg mb-3">Historique</h2>
        <div className="space-y-2">
          {MOCK_ACTIVITIES.map((act) => (
            <div key={act.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm">{act.distanceKm} km</p>
                <p className="text-xs text-muted-foreground">{act.date} · {act.durationMin} min</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">+{act.points} pts</p>
                <p className="text-xs text-muted-foreground">{act.calories} kcal</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
