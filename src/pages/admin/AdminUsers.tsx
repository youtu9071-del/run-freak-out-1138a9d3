import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (u: any) => {
    if (!user) return;
    if (u.user_id === user.id) {
      toast.error("Tu ne peux pas te supprimer toi-même");
      return;
    }
    if (!confirm(`Supprimer définitivement « ${u.username} » ? Cette action est irréversible.`)) return;
    setDeleting(u.user_id);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: u.user_id },
    });
    setDeleting(null);
    if (error || (data && (data as any).error)) {
      toast.error("Erreur : " + (error?.message || (data as any).error));
      return;
    }
    toast.success("Utilisateur supprimé");
    setUsers((prev) => prev.filter((x) => x.user_id !== u.user_id));
  };

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-lg">Utilisateurs ({users.length})</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          placeholder="Rechercher un utilisateur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl bg-card border border-border pl-10 pr-4 py-2.5 text-sm text-foreground"
        />
      </div>

      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className="bg-card rounded-xl p-4 border border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-muted-foreground">{u.username?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{u.username}</p>
              <p className="text-xs text-muted-foreground">
                {u.gender || "—"} · {u.fitness_level || "—"} · Inscrit le {new Date(u.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="text-right mr-2">
              <p className="text-sm font-bold text-primary">{u.total_fp || 0} FP</p>
              <p className="text-xs text-muted-foreground">{u.total_km || 0} km</p>
            </div>
            <button
              onClick={() => handleDelete(u)}
              disabled={deleting === u.user_id || u.user_id === user?.id}
              className="p-2 rounded-lg hover:bg-destructive/20 disabled:opacity-40"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucun utilisateur trouvé</p>}
      </div>
    </div>
  );
}
