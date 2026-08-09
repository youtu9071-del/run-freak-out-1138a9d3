import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, products(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      const list = data || [];
      setRows(list);
      const ids = [...new Set(list.map((r: any) => r.user_id))];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p.username; });
        setNames(map);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground text-center py-10">Aucune commande</p>;

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl bg-card border border-border p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{r.products?.name || "Produit"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {names[r.user_id] || "Utilisateur"} · x{r.quantity}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display font-bold text-sm">{Number(r.total_price).toFixed(0)}</p>
            <p className="text-[10px] text-accent">-{Number(r.fp_used).toFixed(1)} FP</p>
          </div>
        </div>
      ))}
    </div>
  );
}
