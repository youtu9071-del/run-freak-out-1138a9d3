import { motion } from "framer-motion";
import { getLevel, getLevelProgress } from "@/lib/gamification";
import { RANK_LOGOS } from "@/lib/rankLogos";

interface LevelBadgeProps {
  totalKm: number;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
}

export default function LevelBadge({ totalKm, size = "md", showProgress = true }: LevelBadgeProps) {
  const level = getLevel(totalKm);
  const progress = getLevelProgress(totalKm);
  const logo = RANK_LOGOS[level.name];

  const sizes = {
    sm: { img: 56, text: "text-[9px]", bar: 60 },
    md: { img: 88, text: "text-[11px]", bar: 96 },
    lg: { img: 128, text: "text-sm", bar: 140 },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center overflow-hidden shrink-0" style={{ width: s.img, height: s.img, maxWidth: "100%" }}>
        {/* Soft glow halo behind logo */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${level.color}aa 0%, transparent 70%)` }}
          animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        {logo && (
          <motion.img
            key={level.name}
            src={logo}
            alt={level.name}
            className="relative object-contain w-full h-full"
            style={{ filter: `drop-shadow(0 0 10px ${level.color}cc)` }}
            initial={{ scale: 0.6, opacity: 0, rotateY: -20 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0, y: [0, -3, 0] }}
            transition={{
              scale: { duration: 0.5, ease: "easeOut" },
              opacity: { duration: 0.5 },
              rotateY: { duration: 0.5 },
              y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        )}
      </div>
      <span
        className={`font-display font-bold ${s.text} text-center leading-tight uppercase tracking-wider`}
        style={{ color: level.color, textShadow: `0 0 8px ${level.color}55` }}
      >
        {level.name}
      </span>
      {showProgress && (
        <div className="relative h-1 rounded-full bg-muted/40 overflow-hidden" style={{ width: s.bar }}>
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: level.color, boxShadow: `0 0 6px ${level.color}` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}
