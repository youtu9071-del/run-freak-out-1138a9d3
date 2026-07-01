import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Medal, Users, Trophy, Crown, Sparkles, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel } from "@/lib/gamification";
import { supabase } from "@/integrations/supabase/client";

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, username, avatar_url, country, total_km, total_fp")
      .order("total_km", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setLeaderboard(data);
        setLoading(false);
      });
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 16 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2.5 + 1,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5,
      })),
    []
  );

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto relative overflow-x-hidden px-3 sm:px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Ambient background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-72 gradient-hero pointer-events-none -z-10" />
      <div className="absolute inset-0 pointer-events-none -z-10">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-primary/40"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -22, 0], opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">
            Communauté FREAK OUT
          </p>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-foreground leading-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary shrink-0" />
            <span className="truncate">Classement</span>
          </h1>
        </div>
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
        >
          <Trophy className="w-5 h-5 text-primary" />
        </motion.div>
      </motion.div>

      {/* Community stats bar */}
      {!loading && leaderboard.length > 0 && (() => {
        const totalRunners = leaderboard.length;
        const totalKm = leaderboard.reduce((s, e) => s + Number(e.total_km || 0), 0);
        const totalFp = leaderboard.reduce((s, e) => s + Number(e.total_fp || 0), 0);
        const myIdx = leaderboard.findIndex(e => e.user_id === user?.id);
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-4 gap-2 mb-5 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-3"
          >
            {[
              { label: "Coureurs", value: totalRunners.toString() },
              { label: "Km cumulés", value: totalKm.toFixed(0) },
              { label: "FP total", value: totalFp.toFixed(0) },
              { label: "Ton rang", value: myIdx >= 0 ? `#${myIdx + 1}` : "—" },
            ].map((s, i) => (
              <div key={i} className="text-center min-w-0">
                <p className="font-display font-black text-sm sm:text-base text-foreground truncate">{s.value}</p>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold truncate">{s.label}</p>
              </div>
            ))}
          </motion.div>
        );
      })()}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </div>
      )}

      {/* Top 3 Podium */}
      <AnimatePresence>
        {!loading && leaderboard.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-6"
          >
            <div className="absolute inset-0 -m-4 rounded-3xl bg-gradient-to-b from-primary/5 via-transparent to-transparent blur-2xl" />
            <div className="relative flex items-end justify-center gap-2 sm:gap-3">
              {[1, 0, 2].map((idx, order) => {
                const entry = leaderboard[idx];
                if (!entry) return null;
                const isFirst = idx === 0;
                const isUser = entry.user_id === user?.id;
                const heights = isFirst ? "h-24 sm:h-28" : idx === 1 ? "h-16 sm:h-20" : "h-12 sm:h-14";
                const avatarSize = isFirst ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12 sm:w-14 sm:h-14";
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 30, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: 0.15 + order * 0.12,
                      duration: 0.7,
                      ease: [0.34, 1.56, 0.64, 1],
                    }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => entry.user_id !== user?.id && navigate(`/user/${entry.user_id}`)}
                    className="flex flex-col items-center flex-1 min-w-0 max-w-[33%]"
                  >
                    {isFirst && (
                      <motion.div
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mb-1"
                      >
                        <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-accent drop-shadow-[0_0_8px_hsl(var(--accent))]" />
                      </motion.div>
                    )}
                    <div className="relative">
                      {isFirst && (
                        <motion.div
                          className="absolute inset-0 rounded-full bg-primary/40 blur-xl"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                      <div
                        className={`relative rounded-full flex items-center justify-center font-display font-black overflow-hidden ${avatarSize} ${
                          isFirst
                            ? "gradient-primary text-primary-foreground text-xl neon-glow-strong"
                            : "bg-secondary text-foreground text-sm"
                        } ${isUser ? "ring-2 ring-primary" : ""}`}
                      >
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (entry.username?.[0] || "?").toUpperCase()
                        )}
                      </div>
                    </div>
                    <p className="font-display font-bold text-[11px] sm:text-xs mt-2 truncate w-full text-center">
                      {entry.username}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                      {Number(entry.total_km).toFixed(1)} km
                    </p>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      transition={{ delay: 0.4 + order * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      className={`mt-2 w-full max-w-[80px] rounded-t-xl flex items-center justify-center font-display font-black overflow-hidden relative ${heights} ${
                        isFirst
                          ? "gradient-primary text-primary-foreground text-base sm:text-lg"
                          : idx === 1
                          ? "bg-secondary text-foreground text-sm"
                          : "bg-muted text-muted-foreground text-sm"
                      }`}
                    >
                      {isFirst && (
                        <div className="absolute inset-0 opacity-30 shimmer pointer-events-none" />
                      )}
                      <span className="relative">#{idx + 1}</span>
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {!loading && leaderboard.length > 3 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-3 flex items-center justify-between"
        >
          <h2 className="font-display font-black text-base sm:text-lg flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-accent" /> Classement
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Top 20
          </span>
        </motion.div>
      )}

      <div className="space-y-2">
        {leaderboard.slice(3).map((entry, i) => {
          const isUser = entry.user_id === user?.id;
          const entryLevel = getLevel(Number(entry.total_km));
          return (
            <motion.button
              key={entry.user_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ x: 4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => !isUser && navigate(`/user/${entry.user_id}`)}
              className={`w-full rounded-xl p-3 flex items-center gap-3 border text-left transition-colors backdrop-blur-sm ${
                isUser
                  ? "border-primary/40 bg-primary/10 neon-glow"
                  : "border-border bg-card/60 hover:border-primary/30 hover:bg-card"
              }`}
            >
              <span className="font-display font-bold text-xs w-6 text-center text-muted-foreground shrink-0">
                #{i + 4}
              </span>
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center font-display font-bold text-xs overflow-hidden shrink-0 ring-1 ring-border">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (entry.username?.[0] || "?").toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm truncate">
                  {entry.username}
                  {isUser && <span className="text-primary ml-1">(toi)</span>}
                </p>
                <p
                  className="text-[10px] truncate font-medium"
                  style={{ color: entryLevel.color }}
                >
                  {entryLevel.name}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display font-bold text-sm">
                  {Number(entry.total_km).toFixed(1)} km
                </p>
                <p className="text-[10px] text-primary flex items-center justify-end gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  {Number(entry.total_fp).toFixed(1)} FP
                </p>
              </div>
            </motion.button>
          );
        })}
        {!loading && leaderboard.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-card border border-border p-10 text-center"
          >
            <Medal className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun coureur encore</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
