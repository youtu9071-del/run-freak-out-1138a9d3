import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
  delay?: number;
  className?: string;
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  accent,
  delay = 0,
  className = "",
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -3 }}
      className={`premium-card relative overflow-hidden p-4 ${
        accent ? "neon-glow" : "shadow-elevation"
      } ${className}`}
    >
      {accent && (
        <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      )}
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
          accent
            ? "bg-primary/15 text-primary"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`font-display font-black text-2xl tracking-tight ${
            accent ? "text-gradient-primary" : "text-foreground"
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground font-medium">{unit}</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">
        {label}
      </p>
    </motion.div>
  );
}
