import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Smartphone, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const MM_STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  pending: { label: "EN ATTENTE", dot: "🟠", cls: "text-accent" },
  processing: { label: "EN TRAITEMENT", dot: "🔵", cls: "text-blue-400" },
  sent: { label: "ENVOYÉ", dot: "🟢", cls: "text-primary" },
  failed: { label: "ÉCHEC", dot: "🔴", cls: "text-destructive" },
  cancelled: { label: "ANNULÉ", dot: "⚫", cls: "text-muted-foreground" },
};

export default function AdminMobileMoney() {
  const [orders, setOrders] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await (supabase.from("mobile_money_orders" as any) as any)
      .select("*").order("created_at", { ascending: false }).limit(500);
    const rows = (data as any[]) || [];
    setOrders(rows);
    const ids = [...new Set(rows.map(r => r.user_id).concat(rows.map(r => r.processed_by).filter(Boolean)))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
      setNames(Object.fromEntries((profs || []).map(p => [p.user_id, p.username])));
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (status: string) => {
    if (!open || busy) return;
    const labels: Record<string, string> = { processing: "marquer en traitement", sent: "confirmer l'envoi", failed: "marquer en échec (FP remboursés)", cancelled: "annuler (FP remboursés)" };
    if (!confirm(`Voulez-vous ${labels[status]} pour ${open.order_number} ?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_mm_order" as any, { p_order_id: open.id, p_status: status });
    setBusy(false);
    if (error) { toast.error(error.message.includes("ALREADY_CLOSED") ? "Commande déjà clôturée" : error.message); return; }
    toast.success("Commande mise à jour");
    setOpen(null); load();
  };

  const list = orders.filter(o => filter === "all" || o.status === filter);
  const fmt = (o: any) => `${Number(o.payout_amount).toLocaleString()} ${o.payout_currency}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display font-bold text-lg flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Commandes Mobile Money ({list.length})</h2>
        <button onClick={load} className="p-2 rounded-lg bg-secondary"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {["all", ...Object.keys(MM_STATUS)].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {s === "all" ? "Toutes" : `${MM_STATUS[s].dot} ${MM_STATUS[s].label}`}
            {s !== "all" && ` (${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map(o => {
          const st = MM_STATUS[o.status] || MM_STATUS.pending;
          return (
            <button key={o.id} onClick={() => setOpen(o)}
              className="w-full text-left bg-card rounded-xl p-3.5 border border-border hover:border-primary/40 transition-colors">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{o.order_number}</p>
                  <p className="font-semibold text-sm truncate">@{names[o.user_id] || "—"} · {o.operator} · {o.country || "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmt(o)} → <span className="font-mono text-foreground">{o.phone_number}</span></p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-bold ${st.cls}`}>{st.dot} {st.label}</p>
                  <p className="text-xs font-bold text-accent">{o.fp_price} FP</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</p>
                </div>
              </div>
            </button>
          );
        })}
        {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Aucune commande</p>}
      </div>

      <Dialog open={!!open} onOpenChange={o => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Commande {open?.order_number}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/50 p-3 space-y-1.5 text-sm">
                {[
                  ["Client", `@${names[open.user_id] || "—"}`],
                  ["Produit", open.product_name],
                  ["Opérateur", open.operator],
                  ["Pays", open.country || "—"],
                  ["Montant à envoyer", fmt(open)],
                  ["Numéro bénéficiaire", open.phone_number],
                  ["Prix payé", `${open.fp_price} FP`],
                  ["Date", new Date(open.created_at).toLocaleString("fr-FR")],
                  ["Statut", `${MM_STATUS[open.status]?.dot} ${MM_STATUS[open.status]?.label}`],
                  ...(open.processed_at ? [["Traité le", new Date(open.processed_at).toLocaleString("fr-FR")], ["Traité par", `@${names[open.processed_by] || "admin"}`]] : []),
                  ...(open.refunded ? [["Remboursement", "FP restitués"]] : []),
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-3">
                    <span className="text-muted-foreground text-xs">{l}</span>
                    <span className="font-bold text-xs text-right break-all">{v}</span>
                  </div>
                ))}
              </div>
              {["pending", "processing"].includes(open.status) ? (
                <div className="grid grid-cols-2 gap-2">
                  {open.status === "pending" && (
                    <button disabled={busy} onClick={() => act("processing")} className="col-span-2 py-2 rounded-xl bg-secondary text-sm font-bold">🔵 Marquer en traitement</button>
                  )}
                  <button disabled={busy} onClick={() => act("sent")} className="col-span-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold">🟢 Confirmer l'envoi</button>
                  <button disabled={busy} onClick={() => act("failed")} className="py-2 rounded-xl bg-destructive/15 text-destructive text-sm font-bold">🔴 Échec</button>
                  <button disabled={busy} onClick={() => act("cancelled")} className="py-2 rounded-xl bg-secondary text-sm font-bold">⚫ Annuler</button>
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground">Commande clôturée — conservée dans l'historique.</p>
              )}
              <p className="text-[10px] text-muted-foreground text-center">Transfert à effectuer manuellement via l'opérateur. Aucune API automatique n'est connectée.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
