import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Swords, Lock, Timer, Trophy, Play, CheckCircle2, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Duel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  distance_km: number;
  status: string;
  stake_fp: number;
  coffre_amount: number;
  coffre_fee: number;
  winner_id: string | null;
  winner_reward: number;
  duel_ends_at: string | null;
  accepted_at: string | null;
  opponent: { username: string; avatar_url: string | null } | null;
  mine?: { distance_km: number; duration_seconds: number } | null;
  theirs?: { distance_km: number; duration_seconds: number } | null;
}

function useCountdown(target?: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "00h 00min 00s";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}min ${String(s).padStart(2, "0")}s`;
}

function Countdown({ target }: { target?: string | null }) {
  const label = useCountdown(target);
  if (!label) return null;
  return (
    <span className="font-display font-black tabular-nums text-accent">{label}</span>
  );
}

export default function DuelsPanel() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    await supabase.rpc("expire_duels" as any);
    const { data } = await supabase
      .from("challenge_invites")
      .select("*")
      .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });

    const rows = (data || []) as any[];
    const enriched: Duel[] = await Promise.all(
      rows.map(async (d) => {
        const opponentId = d.challenger_id === user.id ? d.challenged_id : d.challenger_id;
        const { data: prof } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", opponentId)
          .maybeSingle();
        const { data: parts } = await supabase
          .from("duel_participations" as any)
          .select("user_id, distance_km, duration_seconds")
          .eq("invite_id", d.id);
        const list = (parts || []) as any[];
        return {
          ...d,
          opponent: prof as any,
          mine: list.find((p) => p.user_id === user.id) || null,
          theirs: list.find((p) => p.user_id === opponentId) || null,
        };
      })
    );
    setDuels(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc(
      accept ? ("accept_duel_invite" as any) : ("refuse_duel_invite" as any),
      { p_invite_id: id }
    );
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(accept ? "Duel accepté ! 72 h démarrées ⚔️" : "Défi refusé");
    refreshProfile();
    load();
  };

  const runDuel = (d: Duel) => {
    sessionStorage.setItem("active_duel", JSON.stringify({ id: d.id, distance: d.distance_km }));
    toast.success(`Cours ${d.distance_km} km pour ce duel 🔥`);
    navigate("/activity");
  };

  if (loading || duels.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Swords className="w-4 h-4 text-accent" />
        <h2 className="font-display font-black text-sm tracking-wide">DUELS 1V1</h2>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
          Mise 5 FP · Coffre 10 FP
        </span>
      </div>

      <AnimatePresence>
        {duels.map((d, i) => {
          const isChallenger = d.challenger_id === user?.id;
          const pending = d.status === "pending";
          const waitingMe = pending && !isChallenger;
          const payout = Math.max(Number(d.coffre_amount || 10) - Number(d.coffre_fee || 1), 0);

          return (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-3xl border border-accent/20 bg-card/70 backdrop-blur-xl p-4"
            >
              <div className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full bg-accent/10 blur-3xl" />

              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-secondary flex items-center justify-center shrink-0 border border-border">
                  {d.opponent?.avatar_url ? (
                    <img src={d.opponent.avatar_url} alt={d.opponent.username} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <Swords className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-sm truncate">
                    vs {d.opponent?.username || "Adversaire"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.distance_km} km · {pending ? (isChallenger ? "En attente de réponse" : "Défi reçu") : "Duel en cours"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 justify-end text-[10px] text-muted-foreground uppercase tracking-wide">
                    <Lock className="w-3 h-3" /> Coffre
                  </div>
                  <p className="font-display font-black text-primary">{Number(d.coffre_amount || 0).toFixed(0)} FP</p>
                </div>
              </div>

              {/* Compte à rebours */}
              {d.status === "accepted" && d.duel_ends_at && (
                <div className="relative mt-3 rounded-2xl bg-background/50 border border-border px-3 py-2 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-accent" />
                  <span className="text-[11px] text-muted-foreground">Temps restant</span>
                  <span className="ml-auto text-sm"><Countdown target={d.duel_ends_at} /></span>
                </div>
              )}

              {/* Participations */}
              {d.status === "accepted" && (
                <div className="relative mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-primary/[0.07] border border-primary/20 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Toi</p>
                    <p className="font-display font-black text-sm">
                      {d.mine ? `${Number(d.mine.distance_km).toFixed(2)} km` : "En attente"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary/60 border border-border px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Adversaire</p>
                    <p className="font-display font-black text-sm">
                      {d.theirs ? `${Number(d.theirs.distance_km).toFixed(2)} km` : "En attente"}
                    </p>
                  </div>
                </div>
              )}

              <div className="relative mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Trophy className="w-3.5 h-3.5 text-accent" />
                Récompense potentielle <span className="text-accent font-bold">{payout} FP</span>
                <span className="opacity-60">· frais {Number(d.coffre_fee || 1)} FP</span>
              </div>

              {/* Actions */}
              <div className="relative mt-3 flex gap-2">
                {waitingMe && (
                  <>
                    <button
                      disabled={busy === d.id}
                      onClick={() => respond(d.id, true)}
                      className="flex-1 rounded-2xl gradient-primary py-3 font-display font-bold text-sm text-primary-foreground neon-glow disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Handshake className="w-4 h-4" /> ACCEPTER · 5 FP
                    </button>
                    <button
                      disabled={busy === d.id}
                      onClick={() => respond(d.id, false)}
                      className="rounded-2xl px-4 py-3 bg-secondary text-secondary-foreground font-bold text-sm disabled:opacity-50"
                    >
                      Refuser
                    </button>
                  </>
                )}
                {pending && isChallenger && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Tes 5 FP sont bloqués. Ils te seront rendus en cas de refus ou d'expiration.
                  </p>
                )}
                {d.status === "accepted" && (
                  d.mine ? (
                    <div className="flex-1 rounded-2xl bg-primary/10 border border-primary/25 py-3 flex items-center justify-center gap-2 text-primary font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Participation enregistrée
                    </div>
                  ) : (
                    <button
                      onClick={() => runDuel(d)}
                      className="flex-1 rounded-2xl gradient-accent py-3 font-display font-bold text-sm text-accent-foreground accent-glow flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" /> COURIR MON DUEL
                    </button>
                  )
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
