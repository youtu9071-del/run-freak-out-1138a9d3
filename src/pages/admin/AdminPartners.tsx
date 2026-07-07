import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Link2, Trash2, Users, Check } from "lucide-react";

interface Invite {
  id: string; token: string; note: string | null;
  created_at: string; expires_at: string;
  used_by: string | null; used_at: string | null;
}

export default function AdminPartners() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [partners, setPartners] = useState<{ user_id: string; username: string | null }[]>([]);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("partner_invites" as any).select("*").order("created_at", { ascending: false });
    setInvites((data as any) || []);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "partner" as any);
    if (roles?.length) {
      const ids = roles.map((r: any) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
      setPartners((profs as any) || []);
    } else setPartners([]);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("partner_invites" as any).insert({ note: note || null, created_by: u.user?.id });
    setCreating(false);
    if (error) { toast.error("Erreur"); return; }
    setNote("");
    load();
    toast.success("Lien partenaire créé");
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/partner/claim/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Lien copié");
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce lien ?")) return;
    await supabase.from("partner_invites" as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold">Générer un lien partenaire</h3>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Note (ex: Bar du coin)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button onClick={create} disabled={creating} className="gradient-primary">Générer</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Lien valable 7 jours, usage unique. Le partenaire devra se connecter puis pourra scanner les QR codes.</p>
        </CardContent>
      </Card>

      <div>
        <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Link2 className="w-4 h-4" /> Liens émis</h3>
        <div className="space-y-2">
          {invites.length === 0 && <p className="text-sm text-muted-foreground">Aucun lien pour l'instant</p>}
          {invites.map((i) => {
            const expired = new Date(i.expires_at) < new Date();
            const used = !!i.used_by;
            return (
              <Card key={i.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold truncate">{i.note || "Sans nom"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {used ? "Utilisé" : expired ? "Expiré" : `Expire le ${new Date(i.expires_at).toLocaleDateString("fr-FR")}`}
                    </div>
                  </div>
                  {!used && !expired && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                      {copied === i.token ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-display font-bold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Partenaires actifs ({partners.length})</h3>
        <div className="grid gap-2">
          {partners.length === 0 && <p className="text-sm text-muted-foreground">Aucun partenaire</p>}
          {partners.map((p) => (
            <Card key={p.user_id}><CardContent className="p-3 text-sm font-bold">{p.username || p.user_id.slice(0, 8)}</CardContent></Card>
          ))}
        </div>
      </div>
    </div>
  );
}
