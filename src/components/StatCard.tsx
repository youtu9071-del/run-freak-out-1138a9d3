import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
  delay?: number;
}

export default function StatCard({ icon: Icon, label, value, unit, accent, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-xl p-4 border ${
        accent
          ? "border-primary/20 bg-primary/5 neon-glow"
          : "border-border bg-card"
      }`}
    >
      <Icon className={`w-4 h-4 mb-2 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      <div className="flex items-baseline gap-1">
        <span className="font-display font-bold text-xl text-foreground">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}
