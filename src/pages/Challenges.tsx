import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Users, Plus, ChevronRight, Trophy, Clock, UserPlus, Search, Shield } from "lucide-react";

type Tab = "defis" | "equipes";
type ChallengeView = "list" | "create_team" | "challenge_detail";

interface MockTeam {
  id: string;
  name: string;
  members: string[];
  size: number;
}

interface MockChallenge {
  id: string;
  teamA: string;
  teamB: string;
  distance: number;
  status: "active" | "completed" | "pending";
  timeLeft?: string;
  avgA?: number;
  avgB?: number;
  winner?: string;
}

const MOCK_TEAMS: MockTeam[] = [
  { id: "1", name: "Les Freaks 🔥", members: ["RunnerX", "SpeedDemon", "FlashMcRun"], size: 3 },
  { id: "2", name: "Shadow Squad ⚡", members: ["ShadowRunner", "NightRunner"], size: 2 },
];

const MOCK_CHALLENGES: MockChallenge[] = [
  { id: "1", teamA: "Les Freaks 🔥", teamB: "Shadow Squad ⚡", distance: 5, status: "active", timeLeft: "18h 42min" },
  { id: "2", teamA: "Les Freaks 🔥", teamB: "Urban Sprinters", distance: 3, status: "completed", avgA: 20.2, avgB: 21.3, winner: "Les Freaks 🔥" },
];

export default function Challenges() {
  const [tab, setTab] = useState<Tab>("defis");
  const [view, setView] = useState<ChallengeView>("list");
  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState(3);

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display font-black text-2xl mb-4"
      >
        Défis ⚔️
      </motion.h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: "defis" as Tab, label: "Défis", icon: Swords },
          { id: "equipes" as Tab, label: "Équipes", icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setView("list"); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              tab === id
                ? "gradient-primary text-primary-foreground neon-glow"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "defis" && (
          <motion.div
            key="defis"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Find opponent */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="w-full rounded-2xl gradient-accent p-5 flex items-center gap-4 accent-glow"
            >
              <Search className="w-8 h-8 text-accent-foreground" />
              <div className="text-left">
                <p className="font-display font-bold text-lg text-accent-foreground">TROUVER UN ADVERSAIRE</p>
                <p className="text-xs text-accent-foreground/70">Auto-match avec une équipe de ton niveau</p>
              </div>
            </motion.button>

            {/* Active challenges */}
            <h3 className="font-display font-bold text-sm text-muted-foreground mt-6">DÉFIS EN COURS</h3>
            {MOCK_CHALLENGES.filter(c => c.status === "active").map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-card border border-primary/20 p-4 neon-glow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Swords className="w-4 h-4 text-accent" />
                    <span className="font-display font-bold text-sm">{ch.teamA}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <span className="font-display font-bold text-sm">{ch.teamB}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>{ch.distance} km</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-accent">
                    <Clock className="w-3 h-3" />
                    <span>{ch.timeLeft} restant</span>
                  </div>
                </div>
                {/* Progress mock */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate">RunnerX</span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full gradient-primary" style={{ width: "70%" }} />
                    </div>
                    <span className="text-primary font-bold">✔</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-20 truncate">SpeedDemon</span>
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full gradient-accent" style={{ width: "40%" }} />
                    </div>
                    <span className="text-muted-foreground">en cours...</span>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Completed */}
            <h3 className="font-display font-bold text-sm text-muted-foreground mt-4">TERMINÉS</h3>
            {MOCK_CHALLENGES.filter(c => c.status === "completed").map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold text-sm">{ch.teamA} vs {ch.teamB}</span>
                  <Trophy className="w-4 h-4 text-primary" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{ch.distance} km</span>
                  <span className="text-primary font-bold">🏆 {ch.winner}</span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>Team A: {ch.avgA?.toFixed(1)} min moy.</span>
                  <span>Team B: {ch.avgB?.toFixed(1)} min moy.</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {tab === "equipes" && view === "list" && (
          <motion.div
            key="equipes"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Create team */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setView("create_team")}
              className="w-full rounded-2xl gradient-primary p-5 flex items-center gap-4 neon-glow-strong"
            >
              <Plus className="w-8 h-8 text-primary-foreground" />
              <div className="text-left">
                <p className="font-display font-bold text-lg text-primary-foreground">CRÉER UNE ÉQUIPE</p>
                <p className="text-xs text-primary-foreground/70">2 à 5 joueurs</p>
              </div>
            </motion.button>

            {/* My teams */}
            <h3 className="font-display font-bold text-sm text-muted-foreground">MES ÉQUIPES</h3>
            {MOCK_TEAMS.map((team, i) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-card border border-border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-display font-bold">{team.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {team.members.length}/{team.size}
                  </span>
                </div>
                <div className="flex gap-1">
                  {team.members.map((m, j) => (
                    <div
                      key={j}
                      className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold"
                    >
                      {m[0]}
                    </div>
                  ))}
                  <button className="w-8 h-8 rounded-full border border-dashed border-muted-foreground flex items-center justify-center">
                    <UserPlus className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {tab === "equipes" && view === "create_team" && (
          <motion.div
            key="create_team"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <button
              onClick={() => setView("list")}
              className="text-sm text-muted-foreground mb-2"
            >
              ← Retour
            </button>

            <div className="rounded-2xl bg-card border border-border p-6">
              <h2 className="font-display font-bold text-xl mb-4">Nouvelle équipe</h2>

              <label className="text-xs text-muted-foreground mb-1 block">Nom de l'équipe</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ex: Les Freaks 🔥"
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <label className="text-xs text-muted-foreground mb-2 block">Taille de l'équipe</label>
              <div className="flex gap-2 mb-6">
                {[2, 3, 4, 5].map(size => (
                  <button
                    key={size}
                    onClick={() => setTeamSize(size)}
                    className={`flex-1 py-3 rounded-xl font-display font-bold text-lg transition-all ${
                      teamSize === size
                        ? "gradient-primary text-primary-foreground neon-glow"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {size}v{size}
                  </button>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow"
              >
                CRÉER L'ÉQUIPE
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
