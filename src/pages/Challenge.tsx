import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Zap, ChevronLeft, Search, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getLevel } from "@/lib/gamification";

type ChallengeState = "menu" | "searching" | "matched" | "active" | "result";

const OPPONENT = {
  username: "ShadowRunner",
  totalKm: 92,
  country: "BE",
};

export default function Challenge() {
  const navigate = useNavigate();
  const [state, setState] = useState<ChallengeState>("menu");
  const opponentLevel = getLevel(OPPONENT.totalKm);

  const startSearch = () => {
    setState("searching");
    setTimeout(() => setState("matched"), 2500);
  };

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-muted-foreground text-sm mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Retour
      </button>

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display font-black text-2xl mb-6"
      >
        Défi 1v1 ⚔️
      </motion.h1>

      <AnimatePresence mode="wait">
        {state === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-card border border-border p-6 text-center">
              <Swords className="w-12 h-12 text-accent mx-auto mb-4" />
              <h2 className="font-display font-bold text-xl mb-2">Prêt à combattre ?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Le système va trouver un adversaire de ton niveau. Une distance sera assignée et le plus rapide gagne !
              </p>
              <button
                onClick={startSearch}
                className="w-full rounded-xl gradient-accent px-6 py-4 font-display font-bold text-accent-foreground text-lg accent-glow"
              >
                TROUVER UN ADVERSAIRE
              </button>
            </div>

            {/* Previous challenges */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <h3 className="font-display font-semibold text-sm mb-3">Défis récents</h3>
              <div className="space-y-2">
                {[
                  { opponent: "FlashMcRun", result: "Victoire", distance: 5, color: "text-primary" },
                  { opponent: "UrbanSprint", result: "Défaite", distance: 3, color: "text-destructive" },
                ].map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-semibold">vs {c.opponent}</p>
                      <p className="text-[10px] text-muted-foreground">{c.distance} km</p>
                    </div>
                    <span className={`font-display font-bold text-sm ${c.color}`}>{c.result}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {state === "searching" && (
          <motion.div
            key="searching"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-20 h-20 rounded-full border-4 border-muted border-t-accent mb-6"
            />
            <p className="font-display font-bold text-xl mb-2">Recherche en cours...</p>
            <p className="text-sm text-muted-foreground">Recherche d'un adversaire de ton niveau</p>
          </motion.div>
        )}

        {state === "matched" && (
          <motion.div
            key="matched"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
            </motion.div>
            <p className="font-display font-black text-2xl mb-1">ADVERSAIRE TROUVÉ !</p>
            
            <div className="rounded-2xl bg-card border border-border p-6 mt-6 mb-6">
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mx-auto mb-2 neon-glow">
                    <span className="font-display font-black text-lg text-primary-foreground">R</span>
                  </div>
                  <p className="font-display font-bold text-sm">RunnerX</p>
                  <p className="text-[10px] text-muted-foreground">87.4 km</p>
                </div>
                <Swords className="w-8 h-8 text-accent" />
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full gradient-accent flex items-center justify-center mx-auto mb-2 accent-glow">
                    <span className="font-display font-black text-lg text-accent-foreground">S</span>
                  </div>
                  <p className="font-display font-bold text-sm">{OPPONENT.username}</p>
                  <p className="text-[10px] text-muted-foreground">{OPPONENT.totalKm} km</p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-muted text-center">
                <p className="text-xs text-muted-foreground">Distance assignée</p>
                <p className="font-display font-black text-3xl text-foreground">5.0 <span className="text-lg">km</span></p>
              </div>
            </div>

            <button
              onClick={() => navigate("/activity")}
              className="w-full rounded-xl gradient-primary px-6 py-4 font-display font-bold text-primary-foreground text-lg neon-glow-strong"
            >
              COMMENCER LA COURSE
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
