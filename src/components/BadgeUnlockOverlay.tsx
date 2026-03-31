import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X } from "lucide-react";
import { Level } from "@/lib/gamification";

interface BadgeUnlockOverlayProps {
  level: Level | null;
  onClose: () => void;
}

export default function BadgeUnlockOverlay({ level, onClose }: BadgeUnlockOverlayProps) {
  if (!level) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.3, opacity: 0, rotateY: -180 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          exit={{ scale: 0.3, opacity: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100, duration: 0.8 }}
          className="relative flex flex-col items-center gap-4 p-8 rounded-3xl bg-card border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground">
            <X className="w-5 h-5" />
          </button>

          {/* Glow rings */}
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full"
              style={{ background: `radial-gradient(circle, ${level.color}40 0%, transparent 70%)`, width: 140, height: 140, left: -22, top: -22 }}
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-24 h-24 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: level.color, boxShadow: `0 0 30px ${level.color}60` }}
            >
              <Trophy className="w-10 h-10" style={{ color: level.color }} />
            </motion.div>
          </div>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-muted-foreground font-body uppercase tracking-widest"
          >
            Niveau débloqué
          </motion.p>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="font-display font-black text-2xl text-center"
            style={{ color: level.color }}
          >
            {level.name}
          </motion.h2>

          {/* Particle burst */}
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos((i * Math.PI * 2) / 8) * 100,
                y: Math.sin((i * Math.PI * 2) / 8) * 100,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              className="absolute w-2 h-2 rounded-full"
              style={{ background: level.color, top: "50%", left: "50%" }}
            />
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
