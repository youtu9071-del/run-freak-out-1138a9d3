import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Flame, Route, Timer, Trophy, TrendingUp, Camera } from "lucide-react";
import { MOCK_USER, MOCK_ACTIVITIES, getLevel, LEVELS } from "@/lib/gamification";
import LevelBadge from "@/components/LevelBadge";
import StatCard from "@/components/StatCard";
import BadgeUnlockOverlay from "@/components/BadgeUnlockOverlay";
import RecordNotification from "@/components/RecordNotification";

export default function Profile() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showBadgeUnlock, setShowBadgeUnlock] = useState(false);
  const [record, setRecord] = useState<{ label: string; value: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLevel = getLevel(MOCK_USER.totalKm);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfileImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Demo triggers
  const triggerBadgeDemo = () => setShowBadgeUnlock(true);
  const triggerRecordDemo = () => {
    setRecord({ label: "Plus longue course", value: "12.3 km" });
    setTimeout(() => setRecord(null), 4000);
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Badge Unlock Overlay */}
      <BadgeUnlockOverlay
        level={showBadgeUnlock ? currentLevel : null}
        onClose={() => setShowBadgeUnlock(false)}
      />

      {/* Record Notification */}
      <RecordNotification record={record} onClose={() => setRecord(null)} />

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-8"
      >
        {/* Profile Image */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-20 h-20 rounded-full overflow-hidden mb-3 neon-glow group"
        >
          {profileImage ? (
            <img src={profileImage} alt="Profil" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-primary flex items-center justify-center">
              <span className="font-display font-black text-2xl text-primary-foreground">
                {MOCK_USER.username[0]}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-foreground" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </button>

        <h1 className="font-display font-black text-2xl">{MOCK_USER.username}</h1>
        <div className="flex items-center gap-1 text-muted-foreground text-sm mt-1">
          <MapPin className="w-3 h-3" />
          <span>{MOCK_USER.country}</span>
        </div>
        <div className="mt-4">
          <LevelBadge totalKm={MOCK_USER.totalKm} size="lg" />
        </div>
      </motion.div>

      {/* Demo Buttons */}
      <div className="flex gap-2 mb-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={triggerBadgeDemo}
          className="flex-1 rounded-xl bg-card border border-border p-3 text-center"
        >
          <Trophy className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="font-display font-bold text-xs">Badge unlock</p>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={triggerRecordDemo}
          className="flex-1 rounded-xl bg-card border border-border p-3 text-center"
        >
          <TrendingUp className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="font-display font-bold text-xs">Record perso</p>
        </motion.button>
      </div>

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
