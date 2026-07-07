import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Ticket, Search } from "lucide-react";

interface Row {
  id: string;
  qr_uid: string;
  status: string;
  created_at: string;
  used_at: string | null;
  scanned_by: string | null;
  fp_used: number;
  total_price: number;
  expires_at: string | null;
  products: { name: string | null } | null;
  profiles: { username: string | null } | null;
  scanner: { username: string | null } | null;
}

const statusStyle = (s: string, expired: boolean) => {
  if (s === "used") return "bg-destructive/15 text-destructive border-destructive/30";
  if (expired || s === "expired") return "bg-accent/15 text-accent border-accent/30";
  return "bg-primary/15 text-primary border-primary/30";
};
const statusLabel = (s: string, expired: boolean) => {
  if (s === "used") return "Utilisé";
  if (expired || s === "expired") return "Expiré";
  return "Non scanné";
};

export default function AdminTickets() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("purchase_qrcodes")
        .select("id,qr_uid,status,created_at,used_at,scanned_by,fp_used,total_price,expires_at,products(name),profiles!purchase_qrcodes_user_id_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(200);
      // Fetch scanner usernames
      const scannerIds = Array.from(new Set((data || []).map((r: any) => r.scanned_by).filter(Boolean)));
      let scannerMap: Record<string, string> = {};
      if (scannerIds.length) {
        const { data: sp } = await supabase.from("profiles").select("user_id, username").in("user_id", scannerIds);
        scannerMap = Object.fromEntries((sp || []).map((s: any) => [s.user_id, s.username || ""]));
      }
      setRows(((data as any) || []).map((r: any) => ({ ...r, scanner: r.scanned_by ? { username: scannerMap[r.scanned_by] || null } : null })));
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      r.qr_uid.toLowerCase().includes(t) ||
      (r.products?.name || "").toLowerCase().includes(t) ||
      (r.profiles?.username || "").toLowerCase().includes(t) ||
      (r.scanner?.username || "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Ticket className="w-5 h-5 text-primary" />
        <h3 className="font-display font-bold">Suivi des tickets ({rows.length})</h3>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher (uid, produit, user, scanner)" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.map((r) => {
          const expired = r.expires_at ? new Date(r.expires_at) < new Date() && r.status === "active" : false;
          return (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{r.products?.name || "Produit supprimé"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">UID {r.qr_uid.slice(0, 12)}…</div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-bold border uppercase ${statusStyle(r.status, expired)}`}>
                    {statusLabel(r.status, expired)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-muted-foreground">User: </span><span className="font-bold">{r.profiles?.username || "—"}</span></div>
                  <div><span className="text-muted-foreground">FP: </span><span className="font-bold">{r.fp_used}</span></div>
                  <div><span className="text-muted-foreground">Créé: </span><span className="font-bold">{new Date(r.created_at).toLocaleString("fr-FR")}</span></div>
                  {r.used_at && <div><span className="text-muted-foreground">Scanné: </span><span className="font-bold">{new Date(r.used_at).toLocaleString("fr-FR")}</span></div>}
                  {r.scanner && <div className="col-span-2"><span className="text-muted-foreground">Partenaire: </span><span className="font-bold text-primary">{r.scanner.username || "—"}</span></div>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Aucun ticket</p>}
      </div>
    </div>
  );
}
