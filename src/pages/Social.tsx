import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Medal, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel } from "@/lib/gamification";
import { supabase } from "@/integrations/supabase/client";

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, username, avatar_url, country, total_km, total_fp")
      .order("total_km", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setLeaderboard(data); });
  }, []);

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="font-display font-black text-2xl text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" /> Social
        </h1>
        <p className="text-sm text-muted-foreground">Classement & communauté</p>
      </motion.div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {[1, 0, 2].map((idx) => {
            const entry = leaderboard[idx];
            if (!entry) return null;
            const isFirst = idx === 0;
            const isUser = entry.user_id === user?.id;
            return (
              <button
                key={idx}
                onClick={() => entry.user_id !== user?.id && navigate(`/user/${entry.user_id}`)}
                className="flex flex-col items-center"
              >
                <div className={`rounded-full flex items-center justify-center font-display font-black mb-1 overflow-hidden ${
                  isFirst ? "w-14 h-14 text-lg gradient-primary neon-glow-strong" : "w-10 h-10 text-sm bg-secondary"
                } ${isUser ? "ring-2 ring-primary" : ""}`}>
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    entry.username[0]
                  )}
                </div>
                <p className="font-display font-bold text-[10px]">{entry.username}</p>
                <p className="text-[9px] text-muted-foreground">{Number(entry.total_km).toFixed(1)} km</p>
                <div className={`mt-1 rounded-t-lg flex items-center justify-center font-display font-black ${
                  isFirst ? "w-14 h-20 gradient-primary text-primary-foreground text-base" :
                  idx === 1 ? "w-12 h-14 bg-secondary text-foreground text-sm" :
                  "w-12 h-10 bg-muted text-muted-foreground text-sm"
                }`}>
                  #{idx + 1}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {leaderboard.slice(3).map((entry, i) => {
          const isUser = entry.user_id === user?.id;
          const entryLevel = getLevel(Number(entry.total_km));
          return (
            <motion.button
              key={entry.user_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.03 }}
              onClick={() => !isUser && navigate(`/user/${entry.user_id}`)}
              className={`w-full rounded-xl p-3 flex items-center gap-3 border text-left ${
                isUser ? "border-primary/30 bg-primary/5 neon-glow" : "border-border bg-card"
              }`}
            >
              <span className="font-display font-bold text-xs w-6 text-center text-muted-foreground">#{i + 4}</span>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-display font-bold text-xs overflow-hidden">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  entry.username[0]
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-xs truncate">
                  {entry.username}
                  {isUser && <span className="text-primary ml-1">(toi)</span>}
                </p>
                <p className="text-[9px] text-muted-foreground">{entryLevel.name}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-xs">{Number(entry.total_km).toFixed(1)} km</p>
                <p className="text-[9px] text-primary">{Number(entry.total_fp).toFixed(1)} FP</p>
              </div>
            </motion.button>
          );
        })}
        {leaderboard.length === 0 && (
          <div className="rounded-xl bg-card border border-border p-8 text-center">
            <Medal className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun coureur encore</p>
          </div>
        )}
      </div>
    </div>
  );
}
