import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShoppingBag, Calendar, Swords, LifeBuoy, Ticket, Route, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminOverview() {
  const [s, setS] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const c = async (t: string, f?: (q: any) => any) => {
        let q: any = supabase.from(t as any).select("*", { count: "exact", head: true });
        if (f) q = f(q);
        const { count } = await q;
        return count || 0;
      };
      const [users, products, events, challenges, tickets, support, qr] = await Promise.all([
        c("profiles"), c("products"), c("events"), c("challenges"),
        c("orders"), c("support_tickets", (q) => q.neq("status", "resolved")),
        c("purchase_qrcodes"),
      ]);
      const { data: agg } = await supabase.from("profiles").select("total_km, total_fp");
      const km = (agg || []).reduce((a: number, p: any) => a + Number(p.total_km || 0), 0);
      const fp = (agg || []).reduce((a: number, p: any) => a + Number(p.total_fp || 0), 0);
      setS({ users, products, events, challenges, tickets, support, qr, km, fp });
    })();
  }, []);

  const cards = [
    { i: Users, l: "Utilisateurs", v: s.users, c: "text-primary" },
    { i: Route, l: "Kilomètres cumulés", v: s.km ? Math.round(s.km) : 0, c: "text-primary" },
    { i: Zap, l: "Freak Points cumulés", v: s.fp ? Math.round(s.fp) : 0, c: "text-accent" },
    { i: Calendar, l: "Événements", v: s.events, c: "text-primary" },
    { i: Swords, l: "Défis", v: s.challenges, c: "text-accent" },
    { i: ShoppingBag, l: "Produits", v: s.products, c: "text-primary" },
    { i: Ticket, l: "QR Codes émis", v: s.qr, c: "text-accent" },
    { i: LifeBuoy, l: "Support en attente", v: s.support, c: "text-destructive" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.l}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-2xl bg-card border border-border p-4"
        >
          <c.i className={`w-5 h-5 mb-3 ${c.c}`} />
          <p className="font-display font-black text-2xl">{c.v ?? 0}</p>
          <p className="text-xs text-muted-foreground">{c.l}</p>
        </motion.div>
      ))}
    </div>
  );
}
