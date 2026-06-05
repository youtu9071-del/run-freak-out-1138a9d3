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
    sm: { ring: 48, stroke: 3, text: "text-[8px]", img: 32 },
    md: { ring: 72, stroke: 4, text: "text-[10px]", img: 52 },
    lg: { ring: 104, stroke: 5, text: "text-xs", img: 80 },
  };

  const s = sizes[size];
  const r = (s.ring - s.stroke * 2) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: s.ring, height: s.ring }}>
        {/* Glow halo */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-60 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${level.color} 0%, transparent 70%)` }}
        />
        {showProgress && (
          <svg width={s.ring} height={s.ring} className="-rotate-90 absolute inset-0">
            <circle
              cx={s.ring / 2}
              cy={s.ring / 2}
              r={r}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={s.stroke}
              opacity={0.3}
            />
            <motion.circle
              cx={s.ring / 2}
              cy={s.ring / 2}
              r={r}
              fill="none"
              stroke={level.color}
              strokeWidth={s.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - progress / 100) }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ filter: `drop-shadow(0 0 4px ${level.color})` }}
            />
          </svg>
        )}
        {logo && (
          <motion.div
            key={level.name}
            initial={{ scale: 0.6, opacity: 0, rotateY: -20 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute rounded-full flex items-center justify-center"
            style={{
              width: s.img,
              height: s.img,
              top: (s.ring - s.img) / 2,
              left: (s.ring - s.img) / 2,
            }}
          >
            <motion.img
              src={logo}
              alt={level.name}
              className="object-contain"
              style={{
                width: "92%",
                height: "92%",
                filter: `drop-shadow(0 0 8px ${level.color}aa)`,
              }}
              animate={{ y: [0, -2, 0], scale: [1, 1.04, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </div>
      <span
        className={`font-display font-bold ${s.text} text-center leading-tight max-w-[120px] uppercase tracking-wider`}
        style={{ color: level.color, textShadow: `0 0 8px ${level.color}55` }}
      >
        {level.name}
      </span>
    </div>
  );
}
