import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Users, UserCheck, Coins, Power } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Setting { enabled: boolean; enabled_at: string | null; disabled_at: string | null }
interface Item { id: string; referrer_username: string; referee_username: string; rewarded: boolean; reward_fp: number; rewarded_at: string | null; created_at: string }

const d = (s: string | null) => (s ? format(new Date(s), "dd/MM/yyyy HH:mm", { locale: fr }) : "—");

export default function AdminReferral() {
  const [s, setS] = useState<Setting | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: st }, { data: list }] = await Promise.all([
      supabase.from("app_settings" as any).select("enabled, enabled_at, disabled_at").eq("key", "referral").maybeSingle(),
      supabase.rpc("admin_referral_list" as any),
    ]);
    setS(st as any);
    setItems(((list as any[]) || []).map((r) => ({ ...r, reward_fp: Number(r.reward_fp) })));
  };
  useEffect(() => { load(); }, []);

  const toggle = async () => {
    if (!s) return;
    const next = !s.enabled;
    if (!confirm(next ? "Activer le système de parrainage ?" : "Désactiver le système de parrainage ? Les parrainages existants seront conservés.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_referral_enabled" as any, { p_enabled: next });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(next ? "Parrainage activé" : "Parrainage désactivé");
    load();
  };

  const sponsors = new Set(items.map((i) => i.referrer_username)).size;
  const distributed = items.reduce((t, i) => t + (i.rewarded ? i.reward_fp : 0), 0);
  const stats = [
    { l: "Parrains", v: sponsors, i: Users },
    { l: "Filleuls", v: items.length, i: UserCheck },
    { l: "FP distribués", v: distributed, i: Coins },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center"><Gift className="w-5 h-5 text-primary" /></div>
        <div className="flex-1 min-w-[180px]">
          <p className="font-display font-black">Gestion du parrainage</p>
          <p className="text-xs text-muted-foreground">Activé le {d(s?.enabled_at ?? null)} · Désactivé le {d(s?.disabled_at ?? null)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-black ${s?.enabled ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
          {s?.enabled ? "Activé" : "Désactivé"}
        </span>
        <button disabled={busy || !s} onClick={toggle}
          className={`rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 disabled:opacity-50 ${s?.enabled ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
          <Power className="w-4 h-4" /> {s?.enabled ? "Désactiver" : "Activer"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((x) => (
          <div key={x.l} className="rounded-2xl border border-border bg-card p-4">
            <x.i className="w-4 h-4 text-primary mb-2" />
            <p className="font-display font-black text-2xl">{x.v}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{x.l}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Aucun parrainage</p> : items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">@{i.referrer_username} <span className="text-muted-foreground font-normal">→</span> @{i.referee_username}</p>
              <p className="text-[11px] text-muted-foreground">Inscrit le {d(i.created_at)}{i.rewarded && ` · Récompensé le ${d(i.rewarded_at)}`}</p>
            </div>
            <span className={`text-xs font-black ${i.rewarded ? "text-primary" : "text-muted-foreground"}`}>
              {i.rewarded ? `+${i.reward_fp} FP` : "En attente (5 km)"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
