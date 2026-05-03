import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Users, Plus, Trophy, Clock, UserPlus, Search, Shield, Calendar, LogIn, X, Check, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Tab = "defis" | "equipes";
type ChallengeView = "list" | "create_team";

export default function Challenges() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("defis");
  const [view, setView] = useState<ChallengeView>("list");
  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [teams, setTeams] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);

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

  useEffect(() => {
    if (user) {
      // Auto-expire passed challenges first
      supabase.rpc("expire_old_challenges" as any).then(() => {
        fetchTeams();
        fetchChallenges();
      });
    }
  }, [user]);

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
      .select("*, team_a:teams!challenges_team_a_id_fkey(id, name), team_b:teams!challenges_team_b_id_fkey(id, name)")
      .order("created_at", { ascending: false }).limit(20);
    if (data) setChallenges(data);
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
            <motion.button whileTap={{ scale: 0.97 }} className="w-full rounded-2xl gradient-accent p-5 flex items-center gap-4 accent-glow">
              <Search className="w-8 h-8 text-accent-foreground" />
              <div className="text-left">
                <p className="font-display font-bold text-lg text-accent-foreground">TROUVER UN ADVERSAIRE</p>
                <p className="text-xs text-accent-foreground/70">Auto-match avec une équipe de ton niveau</p>
              </div>
            </motion.button>

            <h3 className="font-display font-bold text-sm text-muted-foreground mt-6">DÉFIS EN COURS</h3>
            {activeChallenges.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Aucun défi en cours</p>
              </div>
            ) : (
              activeChallenges.map((ch) => (
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
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Shield className="w-3 h-3" /> <span>{ch.distance_km} km</span>
                    </div>
                    <div className="flex items-center gap-1 text-accent">
                      <Clock className="w-3 h-3" /> <span>{ch.time_limit_hours}h restant</span>
                    </div>
                  </div>
                  {(ch.start_date || ch.end_date) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-1.5">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {ch.start_date && format(new Date(ch.start_date), "dd MMM", { locale: fr })}
                        {ch.end_date && ` → ${format(new Date(ch.end_date), "dd MMM yyyy", { locale: fr })}`}
                      </span>
                    </div>
                  )}
                  {!isUserInChallenge(ch) && (
                    <button
                      onClick={() => handleJoinChallenge(ch)}
                      disabled={joiningChallenge === ch.id}
                      className="w-full rounded-xl bg-primary/10 border border-primary/30 py-2 text-sm font-bold text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <LogIn className="w-4 h-4" />
                      {joiningChallenge === ch.id ? "Rejoindre..." : "Rejoindre ce défi"}
                    </button>
                  )}
                </div>
              ))
            )}

            <h3 className="font-display font-bold text-sm text-muted-foreground mt-4">TERMINÉS</h3>
            {completedChallenges.length === 0 ? (
              <div className="rounded-xl bg-card border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">Aucun défi terminé</p>
              </div>
            ) : (
              completedChallenges.map((ch) => (
                <div key={ch.id} className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-bold text-sm">{ch.team_a?.name} vs {ch.team_b?.name}</span>
                    <Trophy className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{ch.distance_km} km</span>
                    {ch.winner_team_id && <span className="text-primary font-bold">🏆 Vainqueur déterminé</span>}
                  </div>
                </div>
              ))
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
    </div>
  );
}
