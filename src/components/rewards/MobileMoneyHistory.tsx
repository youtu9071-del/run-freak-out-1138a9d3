import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { maskPhone } from "./MarketContent";
import { MM_STATUS } from "@/pages/admin/AdminMobileMoney";

export default function MobileMoneyHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (supabase.from("mobile_money_orders" as any) as any)
      .select("id, order_number, operator, country, payout_amount, payout_currency, fp_price, phone_number, status, created_at, processed_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }: any) => setOrders(data || []));
  }, [user]);

  if (!orders.length) return null;

  return (
    <div className="mb-6">
      <h3 className="font-display font-bold text-base mb-3 flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-primary" /> Mobile Money
      </h3>
      <div className="space-y-2">
        {orders.map(o => {
          const st = MM_STATUS[o.status] || MM_STATUS.pending;
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card/60 p-3">
              {o.status === "sent" && <p className="text-xs font-bold text-primary mb-1">✅ Transaction effectuée</p>}
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{o.operator} · {Number(o.payout_amount).toLocaleString()} {o.payout_currency}</p>
                  <p className="text-[11px] text-muted-foreground">{maskPhone(o.phone_number)} · {o.order_number}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(o.processed_at || o.created_at).toLocaleString("fr-FR")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-bold ${st.cls}`}>{st.dot} {st.label}</p>
                  <p className="text-xs font-bold text-accent">{o.fp_price} FP</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
