import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Swords, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [duels, setDuels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: ch }, { data: inv }] = await Promise.all([
      supabase
        .from("challenges")
        .select("*, team_a:teams!challenges_team_a_id_fkey(name), team_b:teams!challenges_team_b_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("challenge_invites")
        .select("*, challenger:profiles!challenge_invites_challenger_id_fkey(username), challenged:profiles!challenge_invites_challenged_id_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setChallenges(ch || []);
    setDuels(inv || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const deleteChallenge = async (id: string) => {
    if (!confirm("Supprimer définitivement ce défi d'équipe ?")) return;
    await supabase.from("challenge_participations").delete().eq("challenge_id", id);
    const { error } = await supabase.from("challenges").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Défi supprimé");
    fetchAll();
  };

  const deleteDuel = async (id: string) => {
    if (!confirm("Supprimer définitivement ce défi 1v1 ?")) return;
    const { error } = await supabase.from("challenge_invites").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Défi 1v1 supprimé");
    fetchAll();
  };

  if (loading) return <p className="text-muted-foreground text-sm">Chargement…</p>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Défis d'équipe ({challenges.length})
        </h2>
        {challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun défi d'équipe</p>
        ) : (
          <div className="space-y-2">
            {challenges.map((c) => (
              <div key={c.id} className="rounded-xl bg-card border border-border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">
                    {c.team_a?.name || "—"} <span className="text-muted-foreground">vs</span> {c.team_b?.name || "(en attente)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.distance_km} km · Mise {c.stake_fp ?? 0} FP · Coffre {Number(c.coffre_amount ?? 0).toFixed(0)} FP · {c.status}
                    {c.end_date && ` · fin ${format(new Date(c.end_date), "dd/MM/yyyy", { locale: fr })}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteChallenge(c.id)}
                  className="shrink-0 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <Swords className="w-5 h-5 text-accent" /> Défis 1v1 ({duels.length})
        </h2>
        {duels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun défi 1v1</p>
        ) : (
          <div className="space-y-2">
            {duels.map((d) => (
              <div key={d.id} className="rounded-xl bg-card border border-border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">
                    {d.challenger?.username || "?"} <span className="text-muted-foreground">vs</span> {d.challenged?.username || "?"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.distance_km} km · {d.challenge_level || "—"} · Mise {d.stake_fp ?? 0} FP · {d.status}
                    {d.scheduled_date && ` · prévu ${format(new Date(d.scheduled_date), "dd/MM HH:mm", { locale: fr })}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteDuel(d.id)}
                  className="shrink-0 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
