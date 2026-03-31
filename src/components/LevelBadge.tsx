import { motion } from "framer-motion";
import { getLevel, getLevelProgress } from "@/lib/gamification";

interface LevelBadgeProps {
  totalKm: number;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
}

export default function LevelBadge({ totalKm, size = "md", showProgress = true }: LevelBadgeProps) {
  const level = getLevel(totalKm);
  const progress = getLevelProgress(totalKm);

  const sizes = {
    sm: { ring: 48, stroke: 3, text: "text-[8px]" },
    md: { ring: 72, stroke: 4, text: "text-[10px]" },
    lg: { ring: 100, stroke: 5, text: "text-xs" },
  };

  const s = sizes[size];
  const r = (s.ring - s.stroke * 2) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: s.ring, height: s.ring }}>
        <svg width={s.ring} height={s.ring} className="-rotate-90">
          <circle
            cx={s.ring / 2}
            cy={s.ring / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={s.stroke}
          />
          {showProgress && (
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
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-display font-black ${s.text}`} style={{ color: level.color }}>
            {level.tier}
          </span>
        </div>
      </div>
      <span className={`font-display font-bold ${s.text} text-center leading-tight max-w-[100px]`} style={{ color: level.color }}>
        {level.name}
      </span>
    </div>
  );
}
