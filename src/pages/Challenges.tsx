import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Users, Plus, Trophy, UserPlus, Timer, X, Check, Trash2, Play, Lock, Crown, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import DuelsPanel from "@/components/DuelsPanel";

type Tab = "defis" | "groupes";
const DISTANCES = [5, 10, 15, 20];
const STAKES = [5, 10, 20, 50];
const DURATIONS = [
  { h: 24, label: "24 h" }, { h: 48, label: "48 h" }, { h: 72, label: "72 h" }, { h: 168, label: "7 j" },
];

interface Member { user_id: string; username: string | null; avatar_url: string | null; distance_km: number | null; duration_seconds: number | null; completed: boolean; }
interface GroupChallenge {
  id: string; status: string; distance_km: number; stake_fp: number; coffre_amount: number; coffre_fee: number;
  winner_reward: number; time_limit_hours: number; end_date: string | null; created_at: string;
  winner_team_id: string | null; is_tie: boolean; avg_a: number | null; avg_b: number | null;
  team_a: { id: string; name: string; creator_id: string | null }; team_b: { id: string; name: string; creator_id: string | null };
  members_a: Member[]; members_b: Member[];
}

export function fmtTime(s?: number | null) {
  if (s == null) return "—";
  const t = Math.round(Number(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min ${String(sec).padStart(2, "0")} s` : `${m} min ${String(sec).padStart(2, "0")} s`;
}

export function groupAverage(members: Member[]): number | null {
  const done = members.filter((m) => m.completed && m.duration_seconds != null);
  if (done.length === 0) return null;
  return done.reduce((a, m) => a + Number(m.duration_seconds), 0) / done.length;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  return now;
}
function Remaining({ target }: { target?: string | null }) {
  const now = useNow();
  if (!target) return null;
  const d = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(d / 86400000), h = Math.floor((d % 86400000) / 3600000), m = Math.floor((d % 3600000) / 60000), s = Math.floor((d % 60000) / 1000);
  return <span className="font-display font-black tabular-nums text-accent">{days > 0 ? `${days} j ` : ""}{String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}min {String(s).padStart(2, "0")}s</span>;
}

const Avatar = ({ m }: { m: { username?: string | null; avatar_url?: string | null } }) => (
  <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-[10px] font-bold shrink-0">
    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.username?.[0] || "?").toUpperCase()}
  </div>
);

export default function Challenges() {
  const { user, profile, refreshProfile } = useAuth() as any;
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("defis");
  const [groups, setGroups] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<GroupChallenge[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [inviteFor, setInviteFor] = useState<any | null>(null);

  const [target, setTarget] = useState<any | null>(null);
  const [dist, setDist] = useState(10);
  const [stake, setStake] = useState(10);
  const [hours, setHours] = useState(72);

  const load = useCallback(async () => {
    if (!user) return;
    await supabase.rpc("expire_team_challenges" as any);
    const [{ data }, { data: inv }] = await Promise.all([
      supabase.rpc("my_group_challenges" as any),
      supabase.from("team_members").select("id, team_id, invited_by").eq("user_id", user.id).eq("status", "invited"),
    ]);
    const d = (data || {}) as any;
    setGroups(d.groups || []);
    setAvailable(d.available || []);
    setChallenges(d.challenges || []);
    const list = await Promise.all((inv || []).map(async (i: any) => {
      const { data: t } = await supabase.from("teams").select("name, status, expires_at").eq("id", i.team_id).maybeSingle();
      const { data: p } = await supabase.from("profiles").select("username").eq("user_id", i.invited_by).maybeSingle();
      return { ...i, team: t, inviter: p?.username };
    }));
    setInvites(list.filter((i) => (i.team as any)?.status === "waiting" && new Date((i.team as any).expires_at) > new Date()));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<{ error: any }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(error.message || "Erreur"); return false; }
    toast.success(ok); refreshProfile?.(); load(); return true;
  };

  const myGroup = groups[0] || null;
  const isCreator = myGroup && myGroup.creator_id === user?.id;
  const acceptedCount = myGroup ? myGroup.members.filter((m: any) => m.status === "accepted").length : 0;

  const searchUsers = async (q: string, exclude: string[]) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase.from("profiles").select("user_id, username, avatar_url").ilike("username", `%${q}%`).neq("user_id", user?.id || "").limit(8);
    setResults((data || []).filter((p: any) => !exclude.includes(p.user_id)));
  };

  const openCreate = () => {
    if (Number(profile?.total_km || 0) < 101) {
      toast.error("Rang GUERRIER DES PAVÉS III (101 km) requis pour créer un groupe.");
      return;
    }
    setCreating(true); setGroupName(""); setSelected([]); setSearch(""); setResults([]);
  };

  const pending = challenges.filter((c) => c.status === "pending");
  const received = pending.filter((c) => c.team_b.creator_id === user?.id);
  const sentOrWaiting = pending.filter((c) => c.team_b.creator_id !== user?.id);
  const active = challenges.filter((c) => c.status === "active");
  const done = challenges.filter((c) => c.status === "completed");

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center neon-glow">
          <Swords className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display font-black text-2xl leading-none">Arène des Défis</h1>
          <p className="text-xs text-muted-foreground mt-1">1V1 et Groupe vs Groupe.</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 p-1 rounded-2xl bg-secondary/50 border border-border">
        {([{ id: "defis" as Tab, label: "Défis", icon: Swords }, { id: "groupes" as Tab, label: "Groupes", icon: Users }]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === id ? "gradient-primary text-primary-foreground neon-glow" : "text-muted-foreground"}`}>
            <Icon className="w-4 h-4" /> {label}
            {id === "defis" && received.length > 0 && <span className="ml-1 text-[10px] px-1.5 rounded-full bg-destructive text-destructive-foreground">{received.length}</span>}
          </button>
        ))}
      </div>

      {tab === "defis" && (
        <div className="space-y-5">
          <DuelsPanel />

          {received.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display font-bold text-sm text-accent">DÉFIS DE GROUPE REÇUS</h3>
              {received.map((c) => (
                <div key={c.id} className="rounded-2xl bg-card border border-accent/30 p-4 space-y-3">
                  <p className="font-display font-bold">🏆 Nouveau défi de groupe</p>
                  <p className="text-sm text-muted-foreground">
                    Le groupe <span className="text-foreground font-bold">{c.team_a.name}</span> te propose un défi de <b className="text-foreground">{c.distance_km} km</b>.
                    Mise : <b className="text-foreground">{c.stake_fp} FP par participant</b> · Durée {c.time_limit_hours} h.
                  </p>
                  <p className="text-[11px] text-muted-foreground">La distance, la mise et les règles ne peuvent pas être modifiées. Les FP ne sont bloqués qu'à l'acceptation.</p>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => run(() => supabase.rpc("respond_group_challenge" as any, { p_challenge_id: c.id, p_accept: true }), "Défi accepté ! FP bloqués dans le coffre 🔒")}
                      className="flex-1 rounded-xl gradient-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">ACCEPTER</button>
                    <button disabled={busy} onClick={() => run(() => supabase.rpc("respond_group_challenge" as any, { p_challenge_id: c.id, p_accept: false }), "Défi refusé")}
                      className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-bold disabled:opacity-50">REFUSER</button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {sentOrWaiting.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-display font-bold text-sm text-muted-foreground">PROPOSITIONS EN ATTENTE</h3>
              {sentOrWaiting.map((c) => (
                <div key={c.id} className="rounded-2xl bg-card border border-border p-3 text-sm">
                  <p className="font-bold">{c.team_a.name} <span className="text-muted-foreground">vs</span> {c.team_b.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.distance_km} km · {c.stake_fp} FP / participant · en attente de réponse</p>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h3 className="font-display font-bold text-sm text-muted-foreground">DÉFIS DE GROUPE EN COURS</h3>
            {active.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-5 text-center text-sm text-muted-foreground">Aucun défi de groupe en cours</div>
            ) : active.map((c) => <ActiveCard key={c.id} c={c} userId={user?.id} onRun={() => {
              sessionStorage.setItem("active_team_challenge", JSON.stringify({ id: c.id, distance_km: c.distance_km }));
              navigate("/activity");
            }} />)}
          </section>

          {done.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display font-bold text-sm text-muted-foreground">HISTORIQUE DES DÉFIS DE GROUPE</h3>
              {done.map((c) => <ResultCard key={c.id} c={c} />)}
            </section>
          )}
        </div>
      )}

      {tab === "groupes" && (
        <div className="space-y-5">
          {invites.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-display font-bold text-sm text-accent">INVITATIONS REÇUES</h3>
              {invites.map((i) => (
                <div key={i.id} className="rounded-2xl bg-card border border-accent/30 p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{i.team?.name}</p>
                    <p className="text-[11px] text-muted-foreground">Invité par {i.inviter || "un runner"}</p>
                  </div>
                  <button onClick={() => run(() => supabase.rpc("accept_team_invite" as any, { p_team_id: i.team_id }), "Tu as rejoint le groupe 🔥")}
                    className="p-2 rounded-lg bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                  <button onClick={() => run(() => supabase.from("team_members").delete().eq("id", i.id) as any, "Invitation refusée")}
                    className="p-2 rounded-lg bg-destructive/10 text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </section>
          )}

          {!myGroup ? (
            <button onClick={openCreate} className="w-full rounded-2xl gradient-primary p-5 flex items-center gap-4 neon-glow-strong">
              <Plus className="w-8 h-8 text-primary-foreground" />
              <div className="text-left">
                <p className="font-display font-bold text-lg text-primary-foreground">CRÉER UN GROUPE</p>
                <p className="text-xs text-primary-foreground/70">2 à 5 participants · GUERRIER DES PAVÉS III+ · valable 7 jours</p>
              </div>
            </button>
          ) : (
            <section className="rounded-2xl bg-card border border-primary/25 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-black text-lg truncate">{myGroup.name}</p>
                  <p className="text-[11px] text-muted-foreground">{acceptedCount}/5 participants</p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${myGroup.status === "in_challenge" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                  {myGroup.status === "in_challenge" ? "DÉFI EN COURS" : "EN ATTENTE DE DÉFI"}
                </span>
              </div>
              {myGroup.status === "waiting" && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1.5">
                  <Clock className="w-3 h-3" /> Expire dans <Remaining target={myGroup.expires_at} />
                </div>
              )}
              <div className="space-y-1.5">
                {myGroup.members.map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-2 text-sm">
                    <Avatar m={m} />
                    <span className="flex-1 truncate">{m.username}{m.user_id === myGroup.creator_id && <Crown className="inline w-3 h-3 ml-1 text-accent" />}</span>
                    <span className="text-[10px] text-muted-foreground">{m.status === "invited" ? "Invité" : `${Number(m.total_fp || 0).toFixed(1)} FP`}</span>
                  </div>
                ))}
              </div>
              {isCreator && myGroup.status === "waiting" && (
                <div className="flex gap-2">
                  {myGroup.members.length < 5 && (
                    <button onClick={() => { setInviteFor(myGroup); setSearch(""); setResults([]); }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary/10 border border-primary/30 py-2 text-xs font-bold text-primary">
                      <UserPlus className="w-3 h-3" /> Inviter
                    </button>
                  )}
                  <button onClick={() => { if (confirm(`Supprimer le groupe « ${myGroup.name} » ?`)) run(() => supabase.rpc("delete_group" as any, { p_team_id: myGroup.id }), "Groupe supprimé"); }}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-destructive/10 border border-destructive/30 py-2 text-xs font-bold text-destructive">
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                </div>
              )}
            </section>
          )}

          {myGroup && myGroup.status === "waiting" && (
            <section className="space-y-2">
              <h3 className="font-display font-bold text-sm text-muted-foreground">GROUPES À DÉFIER</h3>
              {available.length === 0 ? (
                <div className="rounded-xl bg-card border border-border p-5 text-center text-sm text-muted-foreground">Aucun groupe disponible pour le moment</div>
              ) : available.map((g) => (
                <div key={g.id} className="rounded-2xl bg-card border border-border p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{g.name}</p>
                    <p className="text-[11px] text-muted-foreground">{g.size} participants · créé par {g.creator_username}</p>
                  </div>
                  {isCreator && (
                    <button onClick={() => { setTarget(g); setDist(10); setStake(10); setHours(72); }}
                      className="rounded-xl gradient-accent px-3 py-2 text-xs font-bold text-accent-foreground">DÉFIER</button>
                  )}
                </div>
              ))}
              {!isCreator && <p className="text-[11px] text-muted-foreground">Seul le créateur du groupe peut lancer un défi.</p>}
            </section>
          )}
        </div>
      )}

      {/* Créer un groupe */}
      <Sheet open={creating} onClose={() => setCreating(false)} title="Nouveau groupe">
        <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nom du groupe"
          className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm" />
        <input value={search} onChange={(e) => searchUsers(e.target.value, selected.map((s) => s.user_id))} placeholder="Inviter un runner (username)"
          className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm" />
        <UserList list={results} onPick={(p) => {
          if (selected.length >= 4) { toast.error("5 participants maximum"); return; }
          setSelected([...selected, p]); setResults(results.filter((r) => r.user_id !== p.user_id));
        }} />
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((m) => (
              <span key={m.user_id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-xs text-primary font-bold">
                {m.username}<button onClick={() => setSelected(selected.filter((s) => s.user_id !== m.user_id))}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Tu es automatiquement membre. Le groupe reste disponible 7 jours pour recevoir ou lancer un défi.</p>
        <button disabled={busy || !groupName.trim()}
          onClick={async () => { const ok = await run(() => supabase.rpc("create_group" as any, { p_name: groupName, p_invitees: selected.map((s) => s.user_id) }), "Groupe créé 🔥"); if (ok) setCreating(false); }}
          className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground disabled:opacity-50">CRÉER LE GROUPE</button>
      </Sheet>

      {/* Inviter */}
      <Sheet open={!!inviteFor} onClose={() => setInviteFor(null)} title={`Inviter dans ${inviteFor?.name || ""}`}>
        <input value={search} onChange={(e) => searchUsers(e.target.value, (inviteFor?.members || []).map((m: any) => m.user_id))} placeholder="Rechercher un username"
          className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm" />
        <UserList list={results} onPick={async (p) => {
          const ok = await run(() => supabase.rpc("invite_to_group" as any, { p_team_id: inviteFor.id, p_user_id: p.user_id }), `${p.username} invité(e)`);
          if (ok) setInviteFor(null);
        }} />
      </Sheet>

      {/* Proposer un défi */}
      <Sheet open={!!target} onClose={() => setTarget(null)} title={`Défier ${target?.name || ""}`}>
        <Chips label="Distance" items={DISTANCES.map((d) => ({ v: d, l: `${d} km` }))} value={dist} onChange={setDist} />
        <Chips label="Mise par participant" items={STAKES.map((s) => ({ v: s, l: `${s} FP` }))} value={stake} onChange={setStake} />
        <Chips label="Durée du défi" items={DURATIONS.map((d) => ({ v: d.h, l: d.label }))} value={hours} onChange={setHours} />
        <div className="rounded-xl bg-secondary/50 border border-border p-3 text-[11px] text-muted-foreground space-y-1">
          <p>Coffre estimé : <b className="text-primary">{stake * (acceptedCount + (target?.size || 0))} FP</b> ({acceptedCount} + {target?.size || 0} participants × {stake} FP)</p>
          <p>Aucun FP n'est retiré tant que l'autre groupe n'a pas accepté. La plus petite moyenne de temps gagne.</p>
        </div>
        <button disabled={busy}
          onClick={async () => { const ok = await run(() => supabase.rpc("propose_group_challenge" as any, { p_my_team: myGroup.id, p_target_team: target.id, p_distance_km: dist, p_stake_fp: stake, p_hours: hours }), "Défi envoyé ⚔️"); if (ok) setTarget(null); }}
          className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground disabled:opacity-50">ENVOYER LE DÉFI</button>
      </Sheet>
    </div>
  );
}

function ActiveCard({ c, userId, onRun }: { c: GroupChallenge; userId?: string; onRun: () => void }) {
  const avgA = groupAverage(c.members_a), avgB = groupAverage(c.members_b);
  const me = [...c.members_a, ...c.members_b].find((m) => m.user_id === userId);
  const leader = avgA == null && avgB == null ? null : avgB == null || (avgA != null && avgA < avgB) ? "a" : avgA == null || avgB < avgA ? "b" : "tie";
  return (
    <div className="rounded-2xl bg-card border border-primary/20 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Distance cible <b className="text-foreground">{c.distance_km} km</b></span>
        <span className="flex items-center gap-1 text-primary font-bold"><Lock className="w-3 h-3" /> Coffre {Number(c.coffre_amount).toFixed(0)} FP</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-background/50 border border-border px-3 py-2 text-[11px]">
        <Timer className="w-4 h-4 text-accent" /> Temps restant <span className="ml-auto text-sm"><Remaining target={c.end_date} /></span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TeamColumn name={c.team_a.name} members={c.members_a} avg={avgA} target={c.distance_km} lead={leader === "a"} />
        <TeamColumn name={c.team_b.name} members={c.members_b} avg={avgB} target={c.distance_km} lead={leader === "b"} />
      </div>
      <p className="text-[11px] text-center text-muted-foreground">
        {leader === null ? "Aucun temps final pour l'instant" : leader === "tie" ? "Égalité provisoire" : `En tête : ${leader === "a" ? c.team_a.name : c.team_b.name} (provisoire)`}
      </p>
      {me && !me.completed && (
        <button onClick={onRun} className="w-full rounded-xl gradient-primary py-2.5 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 neon-glow">
          <Play className="w-4 h-4" /> COURIR {c.distance_km} KM
        </button>
      )}
      {me?.completed && (
        <div className="rounded-xl bg-primary/10 border border-primary/30 py-2 text-xs font-bold text-primary text-center">
          <Check className="inline w-3 h-3" /> Ton temps final : {fmtTime(me.duration_seconds)} (verrouillé)
        </div>
      )}
    </div>
  );
}

function TeamColumn({ name, members, avg, target, lead }: { name: string; members: Member[]; avg: number | null; target: number; lead: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 space-y-2 ${lead ? "border-primary/40 bg-primary/[0.06]" : "border-border bg-secondary/30"}`}>
      <p className="font-display font-bold text-xs truncate">{name}</p>
      <div>
        <p className="text-[9px] uppercase text-muted-foreground">Moyenne</p>
        <p className="font-display font-black text-sm">{avg == null ? "—" : fmtTime(avg)}</p>
      </div>
      {members.map((m) => {
        const pct = m.completed ? 100 : Math.min(100, (Number(m.distance_km || 0) / target) * 100);
        return (
          <div key={m.user_id} className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] gap-1">
              <span className="truncate">{m.username}</span>
              <span className={m.completed ? "text-primary font-bold" : "text-muted-foreground"}>{m.completed ? fmtTime(m.duration_seconds) : "En cours"}</span>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function ResultCard({ c }: { c: GroupChallenge }) {
  const winnerName = c.is_tie ? null : c.winner_team_id === c.team_a.id ? c.team_a.name : c.team_b.name;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <motion.div initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
          className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center text-xl">{c.is_tie ? "🤝" : "🏆"}</motion.div>
        <div className="min-w-0">
          <p className="font-display font-bold text-sm truncate">{c.team_a.name} vs {c.team_b.name}</p>
          <p className="text-[11px] text-muted-foreground">{c.distance_km} km · {c.stake_fp} FP / participant</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[{ n: c.team_a.name, a: c.avg_a, w: c.winner_team_id === c.team_a.id }, { n: c.team_b.name, a: c.avg_b, w: c.winner_team_id === c.team_b.id }].map((t) => (
          <div key={t.n} className={`rounded-lg px-2 py-1.5 text-center border ${t.w ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/40"}`}>
            <p className="text-muted-foreground truncate">{t.n}</p>
            <p className="font-bold">{fmtTime(t.a)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs font-bold text-center text-primary">
        {c.is_tie ? "Égalité — mises remboursées" : `Victoire : ${winnerName} · coffre ouvert, ${Number(c.winner_reward).toFixed(0)} FP partagés`}
      </p>
    </motion.div>
  );
}

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold">{title}</h3>
              <button onClick={onClose}><X className="w-4 h-4" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function UserList({ list, onPick }: { list: any[]; onPick: (p: any) => void }) {
  if (list.length === 0) return null;
  return (
    <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl bg-secondary/40 p-1">
      {list.map((p) => (
        <button key={p.user_id} onClick={() => onPick(p)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary text-left text-sm">
          <Avatar m={p} /><span className="flex-1">{p.username}</span><UserPlus className="w-4 h-4 text-primary" />
        </button>
      ))}
    </div>
  );
}

function Chips({ label, items, value, onChange }: { label: string; items: { v: number; l: string }[]; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-2">
        {items.map((i) => (
          <button key={i.v} onClick={() => onChange(i.v)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold ${value === i.v ? "gradient-primary text-primary-foreground" : "bg-secondary"}`}>{i.l}</button>
        ))}
      </div>
    </div>
  );
}
