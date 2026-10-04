import { useCallback, useEffect, useState } from "react";
import { Gift, UserPlus, Check, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Ref {
  kind: "referee" | "referrer";
  other_username: string;
  other_avatar: string | null;
  rewarded: boolean;
  reward_fp: number;
  km: number;
}

const ERRORS: Record<string, string> = {
  USER_NOT_FOUND: "Ce username n'existe pas.",
  SELF_REFERRAL: "Tu ne peux pas te parrainer toi-même.",
  ALREADY_REFERRED: "Tu as déjà un parrain.",
  CIRCULAR_REFERRAL: "Ce joueur est déjà ton filleul.",
  AUTH_REQUIRED: "Connecte-toi pour continuer.",
};

export default function ReferralCard({ compact = false }: { compact?: boolean }) {
  const { user, refreshProfile } = useAuth();
  const [items, setItems] = useState<Ref[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_referral_overview" as any);
    setItems(((data as any[]) || []).map((r) => ({ ...r, km: Number(r.km), reward_fp: Number(r.reward_fp) })));
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`referrals-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => { load(); refreshProfile(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const sponsor = items.find((i) => i.kind === "referrer");
  const referees = items.filter((i) => i.kind === "referee");
  const earned = referees.reduce((s, r) => s + (r.rewarded ? r.reward_fp : 0), 0);

  const submit = async () => {
    const u = name.trim().replace(/^@/, "");
    if (!u || u.length > 50 || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("set_referrer" as any, { p_username: u });
    setBusy(false);
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
      toast.error(code ? ERRORS[code] : "Impossible d'enregistrer le parrainage.");
      return;
    }
    toast.success(`@${data} est maintenant ton parrain 🎉`);
    setName("");
    load();
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><Gift className="w-4 h-4 text-primary" /></div>
          <div>
            <p className="font-display font-black text-sm">Parrainage</p>
            <p className="text-[10px] text-muted-foreground">+2 FP quand ton filleul valide 5 km</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-2xl bg-secondary/50 p-3 text-center">
          <p className="font-display font-black text-xl">{referees.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Filleuls</p>
        </div>
        <div className="rounded-2xl bg-secondary/50 p-3 text-center">
          <p className="font-display font-black text-xl text-accent">{earned.toFixed(0)} <span className="text-xs">FP</span></p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Gagnés</p>
        </div>
      </div>

      {sponsor ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2.5 mb-3 text-xs">
          <Check className="w-4 h-4 text-primary shrink-0" />
          <span>Parrainé par <b>@{sponsor.other_username}</b></span>
        </div>
      ) : (
        <div className="flex gap-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={50}
            placeholder="Username de ton parrain"
            className="flex-1 min-w-0 rounded-xl bg-secondary/60 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="rounded-xl bg-primary text-primary-foreground px-3 font-bold text-xs flex items-center gap-1 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Valider
          </button>
        </div>
      )}

      {!compact && referees.length > 0 && (
        <div className="space-y-2">
          {referees.map((r) => (
            <div key={r.other_username} className="flex items-center gap-3 rounded-2xl bg-secondary/40 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-xs font-bold shrink-0">
                {r.other_avatar ? <img src={r.other_avatar} alt="" className="w-full h-full object-cover" /> : r.other_username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">@{r.other_username}</p>
                <div className="h-1.5 rounded-full bg-background/60 overflow-hidden mt-1">
                  <div className="h-full bg-primary" style={{ width: `${(r.km / 5) * 100}%` }} />
                </div>
              </div>
              {r.rewarded ? (
                <span className="text-[10px] font-black text-primary flex items-center gap-1"><Check className="w-3 h-3" />+{r.reward_fp} FP</span>
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{r.km.toFixed(1)}/5 km</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
