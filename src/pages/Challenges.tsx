import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Users, Plus, Trophy, Clock, UserPlus, Search, Shield, Calendar, LogIn, X, Check, Trash2, Play, Flag, Rocket } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type Tab = "defis" | "equipes";
type ChallengeView = "list" | "create_team";

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("defis");
  const [view, setView] = useState<ChallengeView>("list");
  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [teams, setTeams] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [participations, setParticipations] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);

  // Launch challenge dialog
  const [launchTeam, setLaunchTeam] = useState<any | null>(null);
  const [launchDistance, setLaunchDistance] = useState(5);
  const [launchReward, setLaunchReward] = useState(50);
  const [launchEnd, setLaunchEnd] = useState("");
  const [launching, setLaunching] = useState(false);

  // Accept challenge dialog
  const [acceptChallenge, setAcceptChallenge] = useState<any | null>(null);
  const [acceptTeamId, setAcceptTeamId] = useState<string>("");
  const [accepting, setAccepting] = useState(false);

  // New: date + member invitation
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);

  // Add-member dialog state for existing teams
  const [addMemberTeam, setAddMemberTeam] = useState<any | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);

  // Pending team invitations addressed to current user
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      // Auto-expire passed challenges first
      supabase.rpc("expire_old_challenges" as any).then(() => {
        fetchTeams();
        fetchChallenges();
        fetchPendingInvites();
      });
    }
  }, [user]);

  const fetchPendingInvites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("team_members")
      .select("id, team_id, invited_by, teams:team_id(name), inviter:invited_by(username)")
      .eq("user_id", user.id)
      .eq("status", "invited");
    // Manually fetch team + inviter names (no FK relations in schema)
    if (data && data.length > 0) {
      const enriched = await Promise.all(
        data.map(async (inv: any) => {
          const { data: t } = await supabase.from("teams").select("name").eq("id", inv.team_id).maybeSingle();
          const { data: p } = await supabase.from("profiles").select("username").eq("user_id", inv.invited_by).maybeSingle();
          return { ...inv, team_name: t?.name, inviter_name: p?.username };
        })
      );
      setPendingInvites(enriched);
    } else {
      setPendingInvites([]);
    }
  };

  const respondInvite = async (inviteId: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase
        .from("team_members")
        .update({ status: "accepted" as any })
        .eq("id", inviteId);
      if (error) { toast.error("Erreur"); return; }
      toast.success("Tu as rejoint l'équipe ! 🔥");
    } else {
      const { error } = await supabase.from("team_members").delete().eq("id", inviteId);
      if (error) { toast.error("Erreur"); return; }
      toast.success("Invitation refusée");
    }
    fetchPendingInvites();
    fetchTeams();
  };

  const fetchTeams = async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from("team_members").select("team_id").eq("user_id", user.id).eq("status", "accepted");
    if (!memberships || memberships.length === 0) { setTeams([]); return; }
    const teamIds = memberships.map((m) => m.team_id);
    const { data: teamsData } = await supabase.from("teams").select("*").in("id", teamIds);
    if (teamsData) {
      const teamsWithMembers = await Promise.all(
        teamsData.map(async (team) => {
          const { data: members } = await supabase.from("team_members").select("user_id, status").eq("team_id", team.id);
          return { ...team, members: members || [] };
        })
      );
      setTeams(teamsWithMembers);
    }
  };

  const fetchChallenges = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("challenges")
      .select("*, team_a:teams!challenges_team_a_id_fkey(id, name, creator_id), team_b:teams!challenges_team_b_id_fkey(id, name, creator_id)")
      .order("created_at", { ascending: false }).limit(30);
    if (data) setChallenges(data);
    const { data: parts } = await supabase.from("challenge_participations" as any).select("*");
    if (parts) setParticipations(parts as any[]);
  };

  const handleLaunchChallenge = async () => {
    if (!launchTeam || !user) return;
    setLaunching(true);
    const endIso = launchEnd ? new Date(launchEnd).toISOString() : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error } = await supabase.rpc("start_team_challenge" as any, {
      p_team_id: launchTeam.id,
      p_distance_km: launchDistance,
      p_reward_fp: launchReward,
      p_end_date: endIso,
    });
    setLaunching(false);
    if (error) { toast.error(error.message || "Erreur"); return; }
    toast.success("Défi lancé ! En attente d'un adversaire ⚔️");
    setLaunchTeam(null); setLaunchEnd("");
    fetchChallenges();
  };

  const myCaptainTeamsOfSize = (size: number) =>
    teams.filter((t) => t.creator_id === user?.id && t.members.filter((m: any) => m.status === "accepted").length === size);

  const handleAcceptChallenge = async () => {
    if (!acceptChallenge || !acceptTeamId || !user) return;
    setAccepting(true);
    const { error } = await supabase.rpc("accept_team_challenge" as any, {
      p_challenge_id: acceptChallenge.id,
      p_team_id: acceptTeamId,
    });
    setAccepting(false);
    if (error) { toast.error(error.message || "Erreur"); return; }
    toast.success("Défi relevé ! 🔥");
    setAcceptChallenge(null); setAcceptTeamId("");
    fetchChallenges();
  };

  const startMyRun = (challenge: any) => {
    sessionStorage.setItem("active_team_challenge", JSON.stringify({
      id: challenge.id,
      distance_km: challenge.distance_km,
    }));
    navigate("/activity");
  };

  const handleFinalize = async (challengeId: string) => {
    const { error } = await supabase.rpc("finalize_team_challenge" as any, { p_challenge_id: challengeId });
    if (error) { toast.error(error.message || "Impossible de finaliser"); return; }
    toast.success("Défi finalisé 🏆");
    fetchChallenges();
  };

  const myParticipation = (challengeId: string) =>
    participations.find((p) => p.challenge_id === challengeId && p.user_id === user?.id);

  const challengeProgress = (challenge: any) => {
    const aDone = participations.filter(p => p.challenge_id === challenge.id && p.team_id === challenge.team_a?.id && p.completed).length;
    const bDone = participations.filter(p => p.challenge_id === challenge.id && p.team_id === challenge.team_b?.id && p.completed).length;
    return { aDone, bDone };
  };

  const fetchFollowers = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("followers").select("follower_id").eq("following_id", user.id);
    if (data && data.length > 0) {
      const ids = data.map(f => f.follower_id);
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, username, avatar_url").in("user_id", ids);
      setFollowers(profiles || []);
    }
  };

  const searchUsers = async (query: string) => {
    setInviteSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles").select("user_id, username, avatar_url")
      .ilike("username", `%${query}%`).neq("user_id", user?.id || "").limit(10);
    setSearchResults(data || []);
  };

  const toggleMember = (profile: any) => {
    setSelectedMembers(prev => {
      const exists = prev.find(m => m.user_id === profile.user_id);
      if (exists) return prev.filter(m => m.user_id !== profile.user_id);
      if (prev.length >= teamSize - 1) { toast.error(`Max ${teamSize - 1} membres en plus`); return prev; }
      return [...prev, profile];
    });
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !user) return;
    setCreating(true);
    const { data: team, error } = await supabase.from("teams").insert({ name: teamName.trim(), creator_id: user.id }).select().single();
    if (error) { toast.error("Erreur lors de la création"); setCreating(false); return; }

    // Add creator
    await supabase.from("team_members").insert({ team_id: team.id, user_id: user.id, invited_by: user.id, status: "accepted" });

    // Invite selected members
    for (const member of selectedMembers) {
      await supabase.from("team_members").insert({
        team_id: team.id, user_id: member.user_id, invited_by: user.id, status: "invited",
      });
    }

    // If dates are set, create a challenge directly
    if (startDate && endDate) {
      // Create a placeholder opponent team
      const { data: opponentTeam } = await supabase
        .from("teams").insert({ name: `Adversaire de ${teamName.trim()}`, creator_id: user.id }).select().single();
      if (opponentTeam) {
        await supabase.from("challenges").insert({
          team_a_id: team.id,
          team_b_id: opponentTeam.id,
          distance_km: 5,
          status: "active" as any,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          max_members: teamSize,
        });
      }
    }

    toast.success("Équipe créée ! 🔥");
    setTeamName(""); setView("list"); setCreating(false);
    setSelectedMembers([]); setStartDate(""); setEndDate("");
    fetchTeams(); fetchChallenges();
  };

  const handleJoinChallenge = async (challenge: any) => {
    if (!user) return;
    setJoiningChallenge(challenge.id);
    const teamAId = challenge.team_a?.id;
    const teamBId = challenge.team_b?.id;
    const { data: existingMembership } = await supabase
      .from("team_members").select("id").eq("user_id", user.id)
      .in("team_id", [teamAId, teamBId].filter(Boolean));
    if (existingMembership && existingMembership.length > 0) {
      toast.error("Tu fais déjà partie de ce défi !"); setJoiningChallenge(null); return;
    }
    const maxMembers = challenge.max_members || 5;
    for (const teamId of [teamAId, teamBId]) {
      if (!teamId) continue;
      const { count } = await supabase
        .from("team_members").select("id", { count: "exact", head: true })
        .eq("team_id", teamId).eq("status", "accepted");
      if ((count || 0) < maxMembers) {
        const { error } = await supabase.from("team_members").insert({
          team_id: teamId, user_id: user.id, invited_by: user.id, status: "accepted",
        });
        if (error) { toast.error("Erreur pour rejoindre"); } else {
          toast.success("Tu as rejoint le défi ! 🔥"); fetchChallenges(); fetchTeams();
        }
        setJoiningChallenge(null); return;
      }
    }
    toast.error("Plus de place dans ce défi"); setJoiningChallenge(null);
  };

  const isUserInChallenge = (challenge: any) => {
    if (!user) return false;
    return teams.some(t => t.id === challenge.team_a?.id || t.id === challenge.team_b?.id);
  };

  const handleDeleteTeam = async (team: any) => {
    if (!user || team.creator_id !== user.id) {
      toast.error("Seul le créateur peut supprimer l'équipe");
      return;
    }
    if (!confirm(`Supprimer l'équipe "${team.name}" ?`)) return;
    await supabase.from("team_members").delete().eq("team_id", team.id);
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) {
      toast.error("Erreur lors de la suppression");
    } else {
      toast.success("Équipe supprimée");
      fetchTeams();
      fetchChallenges();
    }
  };

  const searchMembersToAdd = async (query: string) => {
    setMemberSearch(query);
    if (query.length < 2 || !user) { setMemberResults([]); return; }
    const existingIds = (addMemberTeam?.members || []).map((m: any) => m.user_id);
    const { data } = await supabase
      .from("profiles").select("user_id, username, avatar_url")
      .ilike("username", `%${query}%`).neq("user_id", user.id).limit(10);
    setMemberResults((data || []).filter((p: any) => !existingIds.includes(p.user_id)));
  };

  const handleAddMember = async (profile: any) => {
    if (!addMemberTeam || !user) return;
    const { error } = await supabase.from("team_members").insert({
      team_id: addMemberTeam.id,
      user_id: profile.user_id,
      invited_by: user.id,
      status: "invited",
    });
    if (error) {
      toast.error("Erreur lors de l'ajout");
    } else {
      toast.success(`${profile.username} invité(e) ! 🔥`);
      setMemberResults((prev) => prev.filter((p) => p.user_id !== profile.user_id));
      fetchTeams();
    }
  };

  const openChallenges = challenges.filter((c) => c.status === "open");
  const activeChallenges = challenges.filter((c) => c.status === "active");
  const completedChallenges = challenges.filter((c) => c.status === "completed");

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 max-w-lg mx-auto">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="font-display font-black text-2xl mb-4">
        Défis ⚔️
      </motion.h1>

      <div className="flex gap-2 mb-6">
        {([
          { id: "defis" as Tab, label: "Défis", icon: Swords },
          { id: "equipes" as Tab, label: "Équipes", icon: Users },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setView("list"); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              tab === id ? "gradient-primary text-primary-foreground neon-glow" : "bg-secondary text-secondary-foreground"
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "defis" && (
          <motion.div key="defis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setTab("equipes")} className="w-full rounded-2xl gradient-accent p-5 flex items-center gap-4 accent-glow">
              <Rocket className="w-8 h-8 text-accent-foreground" />
              <div className="text-left">
                <p className="font-display font-bold text-lg text-accent-foreground">LANCER UN DÉFI</p>
                <p className="text-xs text-accent-foreground/70">Depuis l'onglet Équipes, choisis ton équipe</p>
              </div>
            </motion.button>

            {/* OPEN CHALLENGES — can be accepted */}
            {openChallenges.length > 0 && (
              <>
                <h3 className="font-display font-bold text-sm text-accent mt-6">DÉFIS OUVERTS À RELEVER</h3>
                {openChallenges.map((ch) => {
                  const isMine = ch.team_a?.creator_id === user?.id;
                  const sizeA = teams.find(t => t.id === ch.team_a?.id)?.members.filter((m: any) => m.status === "accepted").length
                    ?? ch.max_members;
                  return (
                    <div key={ch.id} className="rounded-2xl bg-card border border-accent/30 p-4 accent-glow space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm">{ch.team_a?.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold">EN ATTENTE</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground"><Shield className="w-3 h-3" />{ch.distance_km} km</div>
                        <div className="flex items-center gap-1 text-primary"><Trophy className="w-3 h-3" />{ch.reward_fp} FP</div>
                        <div className="flex items-center gap-1 text-muted-foreground"><Users className="w-3 h-3" />{sizeA}v{sizeA}</div>
                      </div>
                      {ch.end_date && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1.5">
                          <Calendar className="w-3 h-3" />
                          <span>Fin : {format(new Date(ch.end_date), "dd MMM yyyy", { locale: fr })}</span>
                        </div>
                      )}
                      {!isMine && (
                        <button
                          onClick={() => { setAcceptChallenge({ ...ch, requiredSize: sizeA }); setAcceptTeamId(""); }}
                          className="w-full rounded-xl gradient-primary py-2 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2"
                        >
                          <Swords className="w-4 h-4" /> Relever le défi
                        </button>
                      )}
                      {isMine && (
                        <p className="text-xs text-muted-foreground text-center">En attente d'une équipe adverse de {sizeA} joueurs…</p>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            <h3 className="font-display font-bold text-sm text-muted-foreground mt-6">DÉFIS EN COURS</h3>
            {activeChallenges.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Aucun défi en cours</p>
              </div>
            ) : (
              activeChallenges.map((ch) => {
                const inA = teams.some(t => t.id === ch.team_a?.id);
                const inB = teams.some(t => t.id === ch.team_b?.id);
                const inThis = inA || inB;
                const myPart = myParticipation(ch.id);
                const { aDone, bDone } = challengeProgress(ch);
                const sizeA = teams.find(t => t.id === ch.team_a?.id)?.members.filter((m: any) => m.status === "accepted").length ?? ch.max_members;
                const sizeB = teams.find(t => t.id === ch.team_b?.id)?.members.filter((m: any) => m.status === "accepted").length ?? ch.max_members;
                const allDone = aDone >= sizeA && bDone >= sizeB;
                const isAnyCreator = ch.team_a?.creator_id === user?.id || ch.team_b?.creator_id === user?.id;
                return (
                  <div key={ch.id} className="rounded-2xl bg-card border border-primary/20 p-4 neon-glow space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Swords className="w-4 h-4 text-accent" />
                        <span className="font-display font-bold text-sm">{ch.team_a?.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="font-display font-bold text-sm">{ch.team_b?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" />{ch.distance_km} km</span>
                      <span className="text-primary flex items-center gap-1"><Trophy className="w-3 h-3" />{ch.reward_fp} FP</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-secondary/40 px-2 py-1.5 text-center">
                        <p className="text-muted-foreground">{ch.team_a?.name}</p>
                        <p className="font-bold text-primary">{aDone}/{sizeA} terminé(s)</p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 px-2 py-1.5 text-center">
                        <p className="text-muted-foreground">{ch.team_b?.name}</p>
                        <p className="font-bold text-primary">{bDone}/{sizeB} terminé(s)</p>
                      </div>
                    </div>
                    {ch.end_date && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1.5">
                        <Calendar className="w-3 h-3" />
                        <span>Fin : {format(new Date(ch.end_date), "dd MMM yyyy", { locale: fr })}</span>
                      </div>
                    )}
                    {inThis && !myPart?.completed && (
                      <button
                        onClick={() => startMyRun(ch)}
                        className="w-full rounded-xl gradient-primary py-2.5 text-sm font-bold text-primary-foreground flex items-center justify-center gap-2 neon-glow"
                      >
                        <Play className="w-4 h-4" /> COMMENCER MA COURSE
                      </button>
                    )}
                    {myPart?.completed && (
                      <div className="rounded-xl bg-primary/10 border border-primary/30 py-2 text-xs font-bold text-primary text-center flex items-center justify-center gap-2">
                        <Check className="w-3 h-3" /> Tu as terminé : {(myPart.duration_seconds/60).toFixed(1)} min — {myPart.distance_km} km
                      </div>
                    )}
                    {allDone && isAnyCreator && (
                      <button
                        onClick={() => handleFinalize(ch.id)}
                        className="w-full rounded-xl bg-accent/20 border border-accent/40 py-2 text-sm font-bold text-accent flex items-center justify-center gap-2"
                      >
                        <Flag className="w-4 h-4" /> Finaliser le défi
                      </button>
                    )}
                  </div>
                );
              })
            )}

            <h3 className="font-display font-bold text-sm text-muted-foreground mt-4">TERMINÉS</h3>
            {completedChallenges.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Aucun défi terminé</p>
              </div>
            ) : (
              completedChallenges.map((ch) => {
                const winnerName = ch.winner_team_id === ch.team_a?.id ? ch.team_a?.name
                  : ch.winner_team_id === ch.team_b?.id ? ch.team_b?.name : "Match nul";
                const fmt = (s: number | null) => s ? `${(s/60).toFixed(2)} min` : "—";
                return (
                  <div key={ch.id} className="rounded-2xl bg-card border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-sm">{ch.team_a?.name} vs {ch.team_b?.name}</span>
                      <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-secondary/40 px-2 py-1.5 text-center">
                        <p className="text-muted-foreground">{ch.team_a?.name}</p>
                        <p className="font-bold">{fmt(ch.team_a_avg_time)}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/40 px-2 py-1.5 text-center">
                        <p className="text-muted-foreground">{ch.team_b?.name}</p>
                        <p className="font-bold">{fmt(ch.team_b_avg_time)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{ch.distance_km} km · {ch.reward_fp} FP</span>
                      <span className="text-primary font-bold">🏆 {winnerName}</span>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {tab === "equipes" && view === "list" && (
          <motion.div key="equipes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setView("create_team"); fetchFollowers(); }}
              className="w-full rounded-2xl gradient-primary p-5 flex items-center gap-4 neon-glow-strong">
              <Plus className="w-8 h-8 text-primary-foreground" />
              <div className="text-left">
                <p className="font-display font-bold text-lg text-primary-foreground">CRÉER UNE ÉQUIPE</p>
                <p className="text-xs text-primary-foreground/70">2 à 5 joueurs</p>
              </div>
            </motion.button>

            {pendingInvites.length > 0 && (
              <>
                <h3 className="font-display font-bold text-sm text-accent">INVITATIONS REÇUES ({pendingInvites.length})</h3>
                {pendingInvites.map((inv) => (
                  <div key={inv.id} className="rounded-2xl bg-card border border-accent/30 p-4 accent-glow space-y-3">
                    <div>
                      <p className="font-display font-bold text-sm">{inv.team_name || "Équipe"}</p>
                      <p className="text-xs text-muted-foreground">Invité par {inv.inviter_name || "un runner"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondInvite(inv.id, true)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary/10 border border-primary/30 py-2 text-xs font-bold text-primary"
                      >
                        <Check className="w-3 h-3" /> Accepter
                      </button>
                      <button
                        onClick={() => respondInvite(inv.id, false)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-destructive/10 border border-destructive/30 py-2 text-xs font-bold text-destructive"
                      >
                        <X className="w-3 h-3" /> Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <h3 className="font-display font-bold text-sm text-muted-foreground">MES ÉQUIPES</h3>
            {teams.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Aucune équipe</p>
                <p className="text-xs text-muted-foreground mt-1">Crée ta première équipe !</p>
              </div>
            ) : (
              teams.map((team) => {
                const isCreator = user?.id === team.creator_id;
                return (
                  <div key={team.id} className="rounded-2xl bg-card border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-display font-bold">{team.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {team.members.filter((m: any) => m.status === "accepted").length} membres
                      </span>
                    </div>
                    <div className="flex gap-1 mb-3">
                      {team.members.filter((m: any) => m.status === "accepted").map((m: any, j: number) => (
                        <div key={j} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">👤</div>
                      ))}
                    </div>
                    {isCreator && (
                      <div className="space-y-2">
                        <button
                          onClick={() => { setLaunchTeam(team); setLaunchDistance(5); setLaunchReward(50); setLaunchEnd(""); }}
                          className="w-full flex items-center justify-center gap-1 rounded-lg gradient-primary py-2 text-xs font-bold text-primary-foreground neon-glow"
                        >
                          <Rocket className="w-3 h-3" /> Lancer un défi avec cette équipe
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setAddMemberTeam(team); setMemberSearch(""); setMemberResults([]); }}
                            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary/10 border border-primary/30 py-2 text-xs font-bold text-primary"
                          >
                            <UserPlus className="w-3 h-3" /> Ajouter
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-destructive/10 border border-destructive/30 py-2 text-xs font-bold text-destructive"
                          >
                            <Trash2 className="w-3 h-3" /> Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        {tab === "equipes" && view === "create_team" && (
          <motion.div key="create_team" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
            <button onClick={() => setView("list")} className="text-sm text-muted-foreground mb-2">← Retour</button>
            <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
              <h2 className="font-display font-bold text-xl">Nouvelle équipe</h2>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nom de l'équipe</label>
                <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Les Freaks 🔥"
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Taille de l'équipe</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map((size) => (
                    <button key={size} onClick={() => setTeamSize(size)}
                      className={`flex-1 py-3 rounded-xl font-display font-bold text-lg transition-all ${
                        teamSize === size ? "gradient-primary text-primary-foreground neon-glow" : "bg-secondary text-secondary-foreground"
                      }`}>{size}v{size}</button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date de début</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date de fin</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {/* Invite Members */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Inviter des membres</label>
                <input type="text" value={inviteSearch} onChange={(e) => searchUsers(e.target.value)}
                  placeholder="Rechercher un utilisateur..."
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-2" />

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="rounded-xl bg-secondary/50 border border-border p-2 space-y-1 mb-2 max-h-32 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button key={p.user_id} onClick={() => toggleMember(p)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                          selectedMembers.find(m => m.user_id === p.user_id) ? "bg-primary/20" : "hover:bg-secondary"
                        }`}>
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold overflow-hidden">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.username[0]}
                        </div>
                        <span className="flex-1">{p.username}</span>
                        {selectedMembers.find(m => m.user_id === p.user_id) && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Followers toggle */}
                <button onClick={() => setShowFollowers(!showFollowers)}
                  className="text-xs text-primary font-bold flex items-center gap-1">
                  <Users className="w-3 h-3" /> {showFollowers ? "Masquer" : "Voir"} mes abonnés ({followers.length})
                </button>

                {showFollowers && followers.length > 0 && (
                  <div className="rounded-xl bg-secondary/50 border border-border p-2 space-y-1 mt-2 max-h-32 overflow-y-auto">
                    {followers.map((p) => (
                      <button key={p.user_id} onClick={() => toggleMember(p)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                          selectedMembers.find(m => m.user_id === p.user_id) ? "bg-primary/20" : "hover:bg-secondary"
                        }`}>
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold overflow-hidden">
                          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.username[0]}
                        </div>
                        <span className="flex-1">{p.username}</span>
                        {selectedMembers.find(m => m.user_id === p.user_id) && <Check className="w-4 h-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected members */}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedMembers.map((m) => (
                      <span key={m.user_id} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-xs text-primary font-bold">
                        {m.username}
                        <button onClick={() => toggleMember(m)}><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreateTeam} disabled={creating || !teamName.trim()}
                className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow disabled:opacity-50">
                {creating ? "Création..." : "CRÉER L'ÉQUIPE"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add member dialog */}
      <AnimatePresence>
        {addMemberTeam && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setAddMemberTeam(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold">Inviter dans {addMemberTeam.name}</h3>
                <button onClick={() => setAddMemberTeam(null)}><X className="w-4 h-4" /></button>
              </div>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => searchMembersToAdd(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm"
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {memberResults.length === 0 && memberSearch.length >= 2 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Aucun résultat</p>
                )}
                {memberResults.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => handleAddMember(p)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold overflow-hidden">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.username[0]}
                    </div>
                    <span className="flex-1 text-sm">{p.username}</span>
                    <UserPlus className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launch challenge dialog */}
      <AnimatePresence>
        {launchTeam && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setLaunchTeam(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold">Lancer un défi — {launchTeam.name}</h3>
                <button onClick={() => setLaunchTeam(null)}><X className="w-4 h-4" /></button>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Distance (km)</label>
                <div className="flex gap-2">
                  {[3, 5, 10, 21].map((d) => (
                    <button key={d} onClick={() => setLaunchDistance(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold ${launchDistance === d ? "gradient-primary text-primary-foreground" : "bg-secondary"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Récompense FP (pour chaque vainqueur)</label>
                <input type="number" min={10} max={500} value={launchReward} onChange={(e) => setLaunchReward(Number(e.target.value))}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date de fin</label>
                <input type="date" value={launchEnd} onChange={(e) => setLaunchEnd(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm" />
              </div>
              <button onClick={handleLaunchChallenge} disabled={launching}
                className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow disabled:opacity-50">
                {launching ? "Lancement…" : "LANCER LE DÉFI ⚔️"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept challenge dialog */}
      <AnimatePresence>
        {acceptChallenge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setAcceptChallenge(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold">Relever le défi</h3>
                <button onClick={() => setAcceptChallenge(null)}><X className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">
                Choisis ton équipe ({acceptChallenge.requiredSize} joueurs requis) — {acceptChallenge.distance_km} km · {acceptChallenge.reward_fp} FP
              </p>
              {myCaptainTeamsOfSize(acceptChallenge.requiredSize).length === 0 ? (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
                  Aucune de tes équipes n'a {acceptChallenge.requiredSize} membres acceptés. Crée ou complète une équipe.
                </div>
              ) : (
                <div className="space-y-2">
                  {myCaptainTeamsOfSize(acceptChallenge.requiredSize).map((t) => (
                    <button key={t.id} onClick={() => setAcceptTeamId(t.id)}
                      className={`w-full p-3 rounded-xl border text-left transition-colors ${acceptTeamId === t.id ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                      <p className="font-bold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.members.filter((m: any) => m.status === "accepted").length} membres</p>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={handleAcceptChallenge} disabled={accepting || !acceptTeamId}
                className="w-full rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow disabled:opacity-50">
                {accepting ? "Acceptation…" : "RELEVER LE DÉFI 🔥"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
