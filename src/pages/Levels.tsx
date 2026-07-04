import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Lock, X, Check, Trophy } from "lucide-react";
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
  const selectedUnlocked = selectedLevel ? totalKm >= selectedLevel.minKm : false;

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden bg-gradient-to-b from-[#05060a] via-[#0a0f1c] to-[#05060a]">
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary/40"
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
                className={`relative rounded-2xl p-3 flex flex-col items-center text-center transition-all backdrop-blur-sm overflow-hidden ${
                  isCurrent
                    ? "border-2 bg-gradient-to-br from-card to-background"
                    : isUnlocked
                    ? "border border-border bg-card/40 hover:border-primary/40"
                    : "border border-white/5 bg-black/60 hover:border-primary/20"
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

                <div className="relative w-20 h-20 max-w-full flex items-center justify-center mb-2 overflow-hidden shrink-0">
                  {isUnlocked ? (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full blur-2xl"
                        style={{ background: `radial-gradient(circle, ${level.color}aa 0%, transparent 70%)` }}
                        animate={isCurrent ? { scale: [0.9, 1.2, 0.9], opacity: [0.6, 1, 0.6] } : { scale: [0.95, 1.05, 0.95] }}
                        transition={{ duration: isCurrent ? 2.5 : 4, repeat: Infinity, ease: "easeInOut" }}
                      />
                      {logo && (
                        <motion.img
                          src={logo}
                          alt={level.name}
                          className="relative object-contain w-[88%] h-[88%]"
                          style={{ filter: `drop-shadow(0 0 10px ${level.color}cc)` }}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1, y: isCurrent ? [0, -4, 0] : [0, -2, 0] }}
                          transition={{
                            scale: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                            opacity: { duration: 0.5 },
                            y: { duration: isCurrent ? 3 : 5, repeat: Infinity, ease: "easeInOut" },
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-black/80 to-white/[0.02] border border-white/5 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.06),transparent_70%)]" />
                      <Lock className="relative w-7 h-7 text-muted-foreground/60" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <p
                  className={`font-display font-bold text-[11px] leading-tight uppercase tracking-wider ${
                    isCurrent ? "" : isUnlocked ? "text-foreground" : "text-muted-foreground/70"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setSelected(null)}
          >
            {selectedUnlocked && Array.from({ length: 14 }).map((_, i) => (
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
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#0d1322] to-[#05080f] border p-6 text-center"
              style={{
                borderColor: selectedUnlocked ? `${selectedLevel.color}55` : "rgba(255,255,255,0.08)",
                boxShadow: selectedUnlocked ? `0 0 50px ${selectedLevel.color}55` : "0 0 40px rgba(0,0,0,0.6)",
              }}
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 p-1 rounded-full bg-background/40 hover:bg-background/80 z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {selectedUnlocked ? (
                <>
                  <div className="relative mx-auto w-44 h-44 max-w-full mb-4 flex items-center justify-center overflow-hidden">
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
                      className="relative object-contain w-[88%] h-[88%]"
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
                    className="mt-5 rounded-xl bg-background/50 border border-primary/30 p-3 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4 text-primary" />
                    <span className="font-display font-bold text-sm uppercase tracking-wider text-primary">Débloqué</span>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Locked view: never reveal logo */}
                  <div className="relative mx-auto w-40 h-40 mb-5 flex items-center justify-center">
                    <motion.div
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-black/90 to-white/[0.02] border border-white/10"
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                    <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.08),transparent_70%)]" />
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="relative"
                    >
                      <Lock className="w-16 h-16 text-muted-foreground/60" strokeWidth={1.25} />
                    </motion.div>
                  </div>

                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 mb-2">Rang verrouillé</p>
                  <h2 className="font-display font-black text-2xl uppercase tracking-wider text-foreground/90">
                    {selectedLevel.name}
                  </h2>

                  <div className="mt-5 rounded-xl bg-background/50 border border-border p-4 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="w-4 h-4 text-accent" />
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Condition de déblocage</p>
                    </div>
                    <p className="font-display font-black text-lg text-foreground">
                      Atteins {selectedLevel.minKm} km
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Plage : {selectedLevel.minKm}{selectedLevel.maxKm === Infinity ? "+ km" : ` – ${selectedLevel.maxKm} km`}
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl bg-background/50 border border-border p-4 text-left">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Progression</p>
                    <div className="relative h-2 rounded-full bg-muted/30 overflow-hidden mb-2">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (totalKm / selectedLevel.minKm) * 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{totalKm.toFixed(1)} km</span>
                      <span className="text-accent font-bold">
                        Encore {(selectedLevel.minKm - totalKm).toFixed(1)} km 🔥
                      </span>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
