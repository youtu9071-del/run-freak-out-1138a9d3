import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Lock, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LEVELS, getLevel } from "@/lib/gamification";
import { RANK_LOGOS, RANK_DESCRIPTIONS } from "@/lib/rankLogos";

export default function Levels() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const totalKm = profile?.total_km || 0;
  const currentLevel = getLevel(totalKm);
  const [selected, setSelected] = useState<string | null>(null);

  // Floating particles for ambient background
  const particles = useMemo(
    () => Array.from({ length: 18 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: 6 + Math.random() * 6,
    })),
    []
  );

  const selectedLevel = selected ? LEVELS.find((l) => l.name === selected) : null;

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden bg-gradient-to-b from-[#05060a] via-[#0a0f1c] to-[#05060a]">
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -20, 0], opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" /> Retour
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="font-display font-black text-3xl tracking-tight">RANGS & NIVEAUX</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tu es <span className="font-bold" style={{ color: currentLevel.color }}>{currentLevel.name}</span> · {totalKm.toFixed(1)} km parcourus
          </p>
        </motion.div>

        {/* Rank grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LEVELS.map((level, idx) => {
            const isCurrent = level.name === currentLevel.name;
            const isUnlocked = totalKm >= level.minKm;
            const logo = RANK_LOGOS[level.name];
            return (
              <motion.button
                key={level.name}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: idx * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelected(level.name)}
                className={`relative rounded-2xl p-3 flex flex-col items-center text-center transition-all backdrop-blur-sm ${
                  isCurrent
                    ? "border-2 bg-gradient-to-br from-card to-background"
                    : "border border-border bg-card/40 hover:border-primary/40"
                }`}
                style={isCurrent ? { borderColor: level.color, boxShadow: `0 0 24px ${level.color}55` } : {}}
              >
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ boxShadow: `inset 0 0 30px ${level.color}66` }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2.2, repeat: Infinity }}
                  />
                )}

                <div className="relative w-20 h-20 flex items-center justify-center mb-2 overflow-hidden">
                  {/* Soft glow halo */}
                  <motion.div
                    className="absolute inset-0 rounded-full blur-2xl"
                    style={{ background: `radial-gradient(circle, ${level.color}${isUnlocked ? "aa" : "33"} 0%, transparent 70%)` }}
                    animate={isCurrent ? { scale: [0.9, 1.2, 0.9], opacity: [0.6, 1, 0.6] } : isUnlocked ? { scale: [0.95, 1.05, 0.95] } : {}}
                    transition={{ duration: isCurrent ? 2.5 : 4, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {logo && (
                    <motion.img
                      src={logo}
                      alt={level.name}
                      className={`relative object-contain max-w-full max-h-full ${!isUnlocked ? "opacity-50 grayscale" : ""}`}
                      style={{
                        filter: isUnlocked
                          ? `drop-shadow(0 0 10px ${level.color}cc)`
                          : "brightness(0.55)",
                      }}
                      animate={
                        isCurrent
                          ? { y: [0, -4, 0], scale: [1, 1.05, 1] }
                          : isUnlocked
                          ? { y: [0, -2, 0] }
                          : {}
                      }
                      transition={{ duration: isCurrent ? 3 : 5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}

                  {!isUnlocked && (
                    <div className="absolute bottom-0 right-0 bg-background/90 rounded-full p-1 border border-border z-10">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <p
                  className={`font-display font-bold text-[11px] leading-tight uppercase tracking-wider ${
                    isCurrent ? "" : isUnlocked ? "text-foreground" : "text-muted-foreground"
                  }`}
                  style={isCurrent ? { color: level.color, textShadow: `0 0 8px ${level.color}88` } : {}}
                >
                  {level.name}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {level.minKm}{level.maxKm === Infinity ? "+ km" : `–${level.maxKm} km`}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelected(null)}
          >
            {/* Floating particles inside modal */}
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full pointer-events-none"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  background: selectedLevel.color,
                  boxShadow: `0 0 8px ${selectedLevel.color}`,
                }}
                animate={{ y: [0, -40, 0], opacity: [0, 0.9, 0] }}
                transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.7, opacity: 0, rotateY: -25 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#0d1322] to-[#05080f] border p-6 text-center"
              style={{ borderColor: `${selectedLevel.color}55`, boxShadow: `0 0 50px ${selectedLevel.color}55` }}
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 p-1 rounded-full bg-background/40 hover:bg-background/80"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative mx-auto w-44 h-44 mb-4 flex items-center justify-center">
                {/* Expanding light wave */}
                <motion.div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ background: `radial-gradient(circle, ${selectedLevel.color}bb 0%, transparent 65%)` }}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [0.5, 1.4, 1.1], opacity: [0, 0.9, 0.6] }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full blur-3xl"
                  style={{ background: `radial-gradient(circle, ${selectedLevel.color}66 0%, transparent 70%)` }}
                  animate={{ scale: [0.95, 1.1, 0.95], opacity: [0.5, 0.9, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.img
                  src={RANK_LOGOS[selectedLevel.name]}
                  alt={selectedLevel.name}
                  className="relative object-contain w-full h-full"
                  style={{ filter: `drop-shadow(0 0 18px ${selectedLevel.color}dd)` }}
                  initial={{ scale: 0.4, opacity: 0, rotateY: -90 }}
                  animate={{ scale: 1, opacity: 1, rotateY: 0, y: [0, -5, 0] }}
                  transition={{
                    scale: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.5 },
                    rotateY: { duration: 0.7 },
                    y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
              </div>


              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-display font-black text-2xl uppercase tracking-wider"
                style={{ color: selectedLevel.color, textShadow: `0 0 12px ${selectedLevel.color}99` }}
              >
                {selectedLevel.name}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-sm text-muted-foreground mt-3 leading-relaxed"
              >
                {RANK_DESCRIPTIONS[selectedLevel.name]}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mt-5 rounded-xl bg-background/50 border border-border p-3"
              >
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Distance requise</p>
                <p className="font-display font-black text-xl mt-1" style={{ color: selectedLevel.color }}>
                  {selectedLevel.minKm}{selectedLevel.maxKm === Infinity ? "+ km" : ` – ${selectedLevel.maxKm} km`}
                </p>
                {totalKm < selectedLevel.minKm && (
                  <p className="text-[11px] text-accent mt-1">
                    Encore {(selectedLevel.minKm - totalKm).toFixed(1)} km à parcourir 🔥
                  </p>
                )}
                {totalKm >= selectedLevel.minKm && (
                  <p className="text-[11px] text-primary mt-1">Niveau débloqué ✓</p>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
