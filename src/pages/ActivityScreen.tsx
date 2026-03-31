import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Route, Timer, Zap, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculateCalories } from "@/lib/gamification";

type TrackingState = "idle" | "running" | "paused" | "finished";

export default function ActivityScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<TrackingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === "running") {
      intervalRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
        // Simulate distance increase (~10 km/h)
        setDistance((d) => d + 0.00278);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state]);

  const speed = seconds > 0 ? (distance / (seconds / 3600)) : 0;
  const pace = speed > 0 ? 60 / speed : 0;
  const calories = calculateCalories(distance);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleFinish = () => {
    setState("finished");
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col max-w-lg mx-auto">
      {/* Map placeholder */}
      <div className="relative h-[45vh] bg-muted/30 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90" />
        {/* Simulated map grid */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute border-t border-foreground/20 w-full" style={{ top: `${i * 5}%` }} />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute border-l border-foreground/20 h-full" style={{ left: `${i * 5}%` }} />
          ))}
        </div>
        {state === "running" && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-4 h-4 rounded-full bg-primary neon-glow-strong z-10"
          />
        )}
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex-1 px-4 -mt-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-6 mb-4"
        >
          {/* Main stat */}
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Distance</p>
            <p className="font-display font-black text-5xl text-foreground neon-text">
              {distance.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">km</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <Timer className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{formatTime(seconds)}</p>
              <p className="text-[10px] text-muted-foreground">Durée</p>
            </div>
            <div className="text-center">
              <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{speed.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">km/h</p>
            </div>
            <div className="text-center">
              <Route className="w-4 h-4 text-accent mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{calories}</p>
              <p className="text-[10px] text-muted-foreground">kcal</p>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.button
                key="start"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setState("running")}
                className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center neon-glow-strong"
              >
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              </motion.button>
            )}
            {state === "running" && (
              <motion.div key="controls" className="flex items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setState("paused")}
                  className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center"
                >
                  <Pause className="w-6 h-6 text-foreground" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleFinish}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center"
                >
                  <Square className="w-6 h-6 text-destructive-foreground" />
                </motion.button>
              </motion.div>
            )}
            {state === "paused" && (
              <motion.div key="paused" className="flex items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setState("running")}
                  className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center neon-glow"
                >
                  <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleFinish}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center"
                >
                  <Square className="w-6 h-6 text-destructive-foreground" />
                </motion.button>
              </motion.div>
            )}
            {state === "finished" && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center w-full"
              >
                <p className="font-display font-black text-2xl text-primary neon-text mb-2">
                  COURSE TERMINÉE ! 🎉
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  +{Math.round(distance * 10 + (speed > 10 ? distance * 5 : 0))} points gagnés
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="rounded-xl gradient-primary px-8 py-3 font-display font-bold text-primary-foreground"
                >
                  RETOUR
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
