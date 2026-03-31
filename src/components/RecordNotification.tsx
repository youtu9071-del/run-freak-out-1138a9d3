import { motion, AnimatePresence } from "framer-motion";
import { Award, X } from "lucide-react";

interface RecordNotificationProps {
  record: { label: string; value: string } | null;
  onClose: () => void;
}

export default function RecordNotification({ record, onClose }: RecordNotificationProps) {
  return (
    <AnimatePresence>
      {record && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed top-6 right-4 z-50 flex items-center gap-3 rounded-2xl bg-card border border-primary/30 p-4 neon-glow max-w-xs"
        >
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm text-primary">Nouveau record ! 🎉</p>
            <p className="text-xs text-muted-foreground truncate">{record.label}: {record.value}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
