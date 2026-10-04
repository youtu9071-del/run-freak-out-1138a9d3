import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Medal, Users, Trophy, Crown, Zap, ArrowUp, ArrowDown, ArrowRight, Footprints } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel } from "@/lib/gamification";
import { supabase } from "@/integrations/supabase/client";
import ReferralCard from "@/components/ReferralCard";

type Period = "today" | "week" | "month" | "all";
const PERIODS: { v: Period; l: string }[] = [
  { v: "today", l: "Aujourd'hui" },
  { v: "week", l: "Semaine" },
  { v: "month", l: "Mois" },
  { v: "all", l: "Général" },
];

interface Row {
  rank_position: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  distance_km: number;
  total_fp: number;
  previous_position: number | null;
  delta: number | null;
}

const fmtKm = (km: number) => `${km.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
const fmtGap = (km: number) => {
  const m = Math.max(km, 0) * 1000;
  if (m < 1000) return `${Math.max(Math.ceil(m / 10) * 10, 10)} m`;
  return `${(m / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
};

function Delta({ d }: { d: number | null }) {
  if (d === null || d === undefined) return null; // aucune évolution inventée
  if (d > 0) return <span className="inline-flex items-center gap-0.5 text-primary font-bold text-xs tabular-nums"><ArrowUp className="w-3.5 h-3.5" strokeWidth={3} />+{d}</span>;
  if (d < 0) return <span className="inline-flex items-center gap-0.5 text-destructive font-bold text-xs tabular-nums"><ArrowDown className="w-3.5 h-3.5" strokeWidth={3} />−{Math.abs(d)}</span>;
  return <span className="inline-flex items-center gap-0.5 text-blue-400 font-bold text-xs tabular-nums"><ArrowRight className="w-3.5 h-3.5" strokeWidth={3} />0</span>;
}

function Avatar({ r, size = "w-10 h-10" }: { r: Row; size?: string }) {
  return (
    <div className={`${size} rounded-full bg-secondary flex items-center justify-center font-display font-bold text-xs overflow-hidden shrink-0 ring-1 ring-border`}>
      {r.avatar_url ? <img src={r.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (r.username?.[0] || "?").toUpperCase()}
    </div>
  );
}

export default function Social() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const meRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async (p: Period) => {
    const { data } = await supabase.rpc("get_leaderboard" as any, { p_period: p, p_limit: 1000 });
    setRows(((data as any[]) || []).map(r => ({ ...r, distance_km: Number(r.distance_km), total_fp: Number(r.total_fp) })));
    setLoading(false);
    // instantané des positions (max 1x / 12 h côté serveur) pour l'évolution future
    supabase.rpc("snapshot_leaderboard" as any, { p_period: p }).then(() => {});
  }, []);

  useEffect(() => { setLoading(true); load(period); }, [period, load]);

  // Mise à jour temps réel quand une course validée modifie un profil
  useEffect(() => {
    let t: any;
    const ch = supabase.channel("leaderboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        clearTimeout(t); t = setTimeout(() => load(period), 800);
      })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [period, load]);

  const myIdx = useMemo(() => rows.findIndex(r => r.user_id === user?.id), [rows, user?.id]);
  const me = myIdx >= 0 ? rows[myIdx] : null;
  const target = myIdx > 0 ? rows[myIdx - 1] : null; // position actuelle − 1
  const visible = showAll ? rows : rows.slice(0, 50);
  const meVisible = myIdx >= 0 && myIdx < visible.length;

  return (
    <div className="min-h-screen w-full max-w-lg mx-auto relative overflow-x-hidden px-3 sm:px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-72 gradient-hero pointer-events-none -z-10" />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold">Communauté FREAK OUT</p>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-foreground leading-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary shrink-0" /> Classement
          </h1>
        </div>
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
      </div>

      <ReferralCard compact />

      {/* Sélecteur de période */}
      <div className="relative grid grid-cols-4 rounded-2xl bg-card/70 border border-border p-1 mb-4">
        {PERIODS.map(p => (
          <button key={p.v} onClick={() => setPeriod(p.v)} className="relative py-2 text-[11px] font-bold z-10">
            {period === p.v && (
              <motion.span layoutId="period-pill" className="absolute inset-0 rounded-xl bg-primary" transition={{ duration: 0.25 }} />
            )}
            <span className={`relative ${period === p.v ? "text-primary-foreground" : "text-muted-foreground"}`}>{p.l}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-10 text-center">
          <Medal className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun coureur encore</p>
        </div>
      ) : (
        <>
          {/* Ta position + À dépasser */}
          {me && (
            <div className="grid grid-cols-1 gap-2.5 mb-5">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                className="rounded-2xl border border-primary/30 bg-card/80 backdrop-blur-sm p-4 flex items-center gap-3">
                <div className="text-center shrink-0 w-14">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Ta position</p>
                  <p className="font-display font-black text-3xl text-primary leading-none mt-1 tabular-nums">#{me.rank_position}</p>
                </div>
                <div className="w-px self-stretch bg-border" />
                <Avatar r={me} />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm truncate">@{me.username}</p>
                  <p className="text-[11px] truncate" style={{ color: getLevel(Number(me.distance_km)).color }}>
                    {period === "all" ? getLevel(Number(me.distance_km)).name : "Période en cours"} · {fmtKm(me.distance_km)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Delta d={me.delta} />
                  {me.delta !== null && <p className="text-[9px] text-muted-foreground">places</p>}
                </div>
              </motion.div>

              {target ? (
                <motion.div key={target.user_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className="rounded-2xl border border-border bg-card/70 backdrop-blur-sm p-4">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-accent flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> À dépasser
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="font-display font-black text-lg text-muted-foreground tabular-nums">#{target.rank_position}</span>
                    <Avatar r={target} size="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm truncate">{target.username}</p>
                      <p className="text-[11px] truncate" style={{ color: getLevel(Number(target.distance_km)).color }}>
                        {getLevel(Number(target.distance_km)).name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    <div className="rounded-xl bg-secondary/50 px-3 py-2">
                      <p className="text-muted-foreground text-[10px]">{target.username}</p>
                      <p className="font-bold tabular-nums">{fmtKm(target.distance_km)}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/50 px-3 py-2">
                      <p className="text-muted-foreground text-[10px]">Toi</p>
                      <p className="font-bold tabular-nums">{fmtKm(me.distance_km)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 gap-3">
                    <p className="text-sm font-display font-black text-foreground">
                      <span className="text-primary">{fmtGap(target.distance_km - me.distance_km)}</span> pour prendre sa place
                    </p>
                    <button onClick={() => navigate("/activity")}
                      className="shrink-0 px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-black flex items-center gap-1.5">
                      <Footprints className="w-3.5 h-3.5" /> COURIR
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center">
                  <p className="text-2xl">🏆</p>
                  <p className="font-display font-black text-base mt-1">TU ES #1</p>
                  <p className="text-xs text-muted-foreground">
                    {rows.length === 1 ? "Tu es actuellement le premier coureur du classement." : "Défends ta place, les autres arrivent."}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Liste */}
          <LayoutGroup>
            <div className="space-y-1.5">
              {visible.map((r) => {
                const isUser = r.user_id === user?.id;
                const lvl = getLevel(Number(r.distance_km));
                const medal = r.rank_position === 1 ? "🥇" : r.rank_position === 2 ? "🥈" : r.rank_position === 3 ? "🥉" : null;
                const dir = r.delta ? (r.delta > 0 ? -6 : 6) : 0;
                return (
                  <motion.button
                    layout
                    key={r.user_id}
                    ref={isUser ? meRef : undefined}
                    initial={{ opacity: 0, y: dir }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    onClick={() => !isUser && navigate(`/user/${r.user_id}`)}
                    className={`w-full rounded-2xl px-3 py-2.5 flex items-center gap-3 border text-left transition-colors ${
                      isUser ? "border-primary/50 bg-primary/10" : "border-border/60 bg-card/50 hover:bg-card"
                    }`}
                  >
                    <span className={`w-8 text-center shrink-0 font-display font-black tabular-nums ${medal ? "text-lg" : "text-sm text-muted-foreground"}`}>
                      {medal || r.rank_position}
                    </span>
                    <div className="relative">
                      <Avatar r={r} />
                      {r.rank_position === 1 && <Crown className="absolute -top-2 -right-1 w-4 h-4 text-accent" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm truncate text-foreground">
                        {r.username}{isUser && <span className="text-primary ml-1 text-xs">(toi)</span>}
                      </p>
                      <p className="text-[11px] truncate">
                        <span style={{ color: lvl.color }} className="font-semibold">{lvl.name}</span>
                        <span className="text-muted-foreground"> · {fmtKm(r.distance_km)}</span>
                      </p>
                    </div>
                    <div className="shrink-0 w-12 text-right"><Delta d={r.delta} /></div>
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>

          {rows.length > 50 && !showAll && (
            <button onClick={() => setShowAll(true)} className="w-full mt-3 py-2.5 rounded-xl bg-secondary text-xs font-bold text-muted-foreground">
              Voir tout le classement ({rows.length})
            </button>
          )}
        </>
      )}

      {/* Barre fixe « ta position » si hors de la liste visible */}
      <AnimatePresence>
        {me && !meVisible && (
          <motion.button
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            onClick={() => setShowAll(true)}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] w-[calc(100%-1.5rem)] max-w-md z-40 rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-md px-4 py-2.5 flex items-center gap-3 shadow-premium"
          >
            <span className="font-display font-black text-primary text-lg tabular-nums">#{me.rank_position}</span>
            <span className="flex-1 text-left text-sm font-bold truncate">@{me.username} · {fmtKm(me.distance_km)}</span>
            <Delta d={me.delta} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
