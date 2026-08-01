import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Users, UserPlus, Check } from "lucide-react";

interface Profile {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<Profile[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "partner" as any);
    const partnerIds = (roles || []).map((r: any) => r.user_id as string);

    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .order("username", { ascending: true })
      .limit(200);

    const all = (profs as any as Profile[]) || [];
    setPartners(all.filter((p) => partnerIds.includes(p.user_id)));
    setUsers(all.filter((p) => !partnerIds.includes(p.user_id)));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const promote = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: selected, role: "partner" as any });
    setSaving(false);
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      toast.error("Erreur : " + error.message);
      return;
    }
    toast.success("Partenaire nommé");
    setSelected(null);
    load();
  };

  const revoke = async (userId: string) => {
    if (!confirm("Retirer le rôle partenaire ?")) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "partner" as any);
    if (error) {
      toast.error("Erreur");
      return;
    }
    toast.success("Rôle retiré");
    load();
  };

  const Avatar = ({ p }: { p: Profile }) =>
    p.avatar_url ? (
      <img src={p.avatar_url} alt={p.username || "Utilisateur"} className="w-11 h-11 rounded-xl object-cover" />
    ) : (
      <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center">
        <span className="font-display font-black text-primary-foreground">
          {(p.username || "R")[0].toUpperCase()}
        </span>
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold mb-2 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" /> Nommer un partenaire
        </h3>
        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {!loading && users.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun utilisateur disponible</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {users.map((u) => {
            const isSel = selected === u.user_id;
            return (
              <button
                key={u.user_id}
                onClick={() => setSelected(isSel ? null : u.user_id)}
                className={`rounded-2xl border p-3 flex items-center gap-3 text-left transition-colors ${
                  isSel ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <Avatar p={u} />
                <span className="text-sm font-bold truncate flex-1">
                  {u.username || u.user_id.slice(0, 8)}
                </span>
                {isSel && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        <Button
          onClick={promote}
          disabled={!selected || saving}
          className="gradient-primary w-full mt-3"
        >
          Nommer partenaire
        </Button>
      </div>

      <div>
        <h3 className="font-display font-bold mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" /> Partenaires actifs ({partners.length})
        </h3>
        <div className="grid gap-2">
          {partners.length === 0 && <p className="text-sm text-muted-foreground">Aucun partenaire</p>}
          {partners.map((p) => (
            <Card key={p.user_id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar p={p} />
                <span className="text-sm font-bold truncate flex-1">
                  {p.username || p.user_id.slice(0, 8)}
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke(p.user_id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
