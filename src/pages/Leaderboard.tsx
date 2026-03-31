import { motion } from "framer-motion";
import { Medal, ChevronRight } from "lucide-react";
import { MOCK_LEADERBOARD } from "@/lib/gamification";
import { useState } from "react";

const tabs = ["Global", "Semaine", "Saison"];

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState("Global");

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display font-black text-2xl mb-4"
      >
        Classement 🏆
      </motion.h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === tab
                ? "gradient-primary text-primary-foreground neon-glow"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Top 3 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-end justify-center gap-3 mb-8"
      >
        {[1, 0, 2].map((idx) => {
          const entry = MOCK_LEADERBOARD[idx];
          const isFirst = idx === 0;
          return (
            <div key={entry.rank} className="flex flex-col items-center">
              <div
                className={`rounded-full flex items-center justify-center font-display font-black mb-2 ${
                  isFirst
                    ? "w-16 h-16 text-xl gradient-primary neon-glow-strong"
                    : "w-12 h-12 text-base bg-secondary"
                }`}
              >
                {entry.username[0]}
              </div>
              <p className="font-display font-bold text-xs">{entry.username}</p>
              <p className="text-[10px] text-muted-foreground">{entry.totalKm} km</p>
              <div
                className={`mt-2 rounded-t-lg flex items-center justify-center font-display font-black ${
                  isFirst
                    ? "w-16 h-24 gradient-primary text-primary-foreground text-lg"
                    : idx === 1
                    ? "w-14 h-16 bg-secondary text-foreground"
                    : "w-14 h-12 bg-muted text-muted-foreground"
                }`}
              >
                #{entry.rank}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* List */}
      <div className="space-y-2">
        {MOCK_LEADERBOARD.slice(3).map((entry, i) => {
          const isUser = entry.username === "RunnerX";
          return (
            <motion.div
              key={entry.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className={`rounded-xl p-4 flex items-center gap-3 border ${
                isUser ? "border-primary/30 bg-primary/5 neon-glow" : "border-border bg-card"
              }`}
            >
              <span className="font-display font-bold text-sm w-8 text-center text-muted-foreground">
                #{entry.rank}
              </span>
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-display font-bold text-sm">
                {entry.username[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm truncate">
                  {entry.username}
                  {isUser && <span className="text-primary ml-1">(toi)</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {entry.level.name} · {entry.country}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-sm">{entry.totalKm} km</p>
                <p className="text-[10px] text-primary">{entry.totalPoints} pts</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
