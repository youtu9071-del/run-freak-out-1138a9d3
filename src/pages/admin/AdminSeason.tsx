import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, AlertTriangle, Users, Route, Zap, History, ShieldCheck, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Overview = {
  season_number: number;
  season_started_at: string;
  users_count: number;
  total_km: number;
  total_fp: number;
  last_reset_at: string | null;
};

type ResetLog = {
  id: string;
  season_from: number;
  season_to: number;
  users_affected: number;
  total_km_reset: number;
  total_fp_reset: number;
  fp_refunded: number;
  duels_settled: number;
  team_challenges_settled: number;
  result: string;
  created_at: string;
};

const CONFIRM_PHRASE = "RESET SAISON";

export default function AdminSeason() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [logs, setLogs] = useState<ResetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [phrase, setPhrase] = useState("");
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase.rpc("admin_season_overview" as any),
      supabase.from("season_reset_logs" as any).select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    setOv((Array.isArray(o) ? o[0] : o) as Overview | null);
    setLogs((l as any as ResetLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const close = () => { setStep(0); setPhrase(""); };

  const execute = async () => {
    if (phrase.trim().toUpperCase() !== CONFIRM_PHRASE) return;
    setRunning(true);
    const { data, error } = await supabase.rpc("admin_reset_season" as any);
    setRunning(false);
    if (error) {
      toast({
        title: "Réinitialisation échouée",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    const r: any = Array.isArray(data) ? data[0] : data;
    close();
    await load();
    toast({
      title: `SAISON ${r?.new_season} créée`,
      description: `${r?.users_affected} utilisateurs · ${Number(r?.km_reset || 0).toFixed(1)} KM et ${Number(r?.fp_reset || 0).toFixed(1)} FP remis à zéro · ${Number(r?.fp_refunded || 0).toFixed(1)} FP restitués des coffres.`,
    });
  };

  if (loading) {
    return <div className="h-40 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Saison actuelle</p>
        <h3 className="font-display font-black text-3xl mt-1">SAISON {ov?.season_number ?? 1}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Démarrée le {ov?.season_started_at ? new Date(ov.season_started_at).toLocaleDateString("fr-FR") : "—"}
        </p>

        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { i: Users, l: "Utilisateurs", v: String(ov?.users_count ?? 0) },
            { i: Route, l: "KM saison", v: `${Number(ov?.total_km || 0).toFixed(1)}` },
            { i: Zap, l: "FP saison", v: `${Number(ov?.total_fp || 0).toFixed(1)}` },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl bg-muted/30 border border-border p-4">
              <s.i className="w-4 h-4 text-primary" />
              <p className="font-display font-black text-xl mt-2 tabular-nums">{s.v}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep(1)}
          className="mt-6 w-full rounded-2xl gradient-primary py-4 font-display font-black tracking-wide text-primary-foreground flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> RÉINITIALISER LA SAISON
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          Dernière réinitialisation :{" "}
          <span className="text-foreground font-semibold">
            {ov?.last_reset_at ? new Date(ov.last_reset_at).toLocaleString("fr-FR") : "Jamais"}
          </span>
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-primary" />
          <h4 className="font-display font-bold">Journal des réinitialisations</h4>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune réinitialisation enregistrée.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="rounded-2xl bg-muted/30 border border-border p-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold">SAISON {l.season_from} → {l.season_to}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {l.users_affected} utilisateurs · {Number(l.total_km_reset).toFixed(1)} KM et {Number(l.total_fp_reset).toFixed(1)} FP remis à zéro
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.duels_settled} duels et {l.team_challenges_settled} défis d'équipe clôturés · {Number(l.fp_refunded).toFixed(1)} FP restitués
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {step > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={running ? undefined : close}
              className="fixed inset-0 bg-background/85 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-md rounded-3xl border border-destructive/40 bg-card p-6"
            >
              <button onClick={running ? undefined : close} className="absolute right-4 top-4 text-muted-foreground">
                <X className="w-4 h-4" />
              </button>

              {step === 1 ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-destructive/15 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                  </div>
                  <h3 className="font-display font-black text-xl mt-4">RÉINITIALISATION DE LA SAISON</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Cette action va remettre la progression de <b className="text-foreground">tous les utilisateurs</b> à zéro.
                  </p>

                  <div className="mt-4 rounded-2xl bg-muted/30 border border-border p-4 text-sm space-y-1">
                    <p>👥 <b>{ov?.users_count ?? 0}</b> utilisateurs concernés</p>
                    <p>🏃 <b>{Number(ov?.total_km || 0).toFixed(1)}</b> KM de saison → <b className="text-primary">0</b></p>
                    <p>⚡ <b>{Number(ov?.total_fp || 0).toFixed(1)}</b> FP → <b className="text-primary">0</b></p>
                    <p>🏅 Niveaux → <b className="text-primary">ROOKIE I</b></p>
                  </div>

                  <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>
                      Les comptes, profils, rôles, historiques de courses, événements et achats sont conservés. Les duels et
                      défis d'équipe en cours sont clôturés et les FP bloqués dans les coffres sont restitués.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <button onClick={close} className="rounded-2xl border border-border py-3 font-display font-bold text-sm">
                      ANNULER
                    </button>
                    <button onClick={() => setStep(2)} className="rounded-2xl bg-destructive text-destructive-foreground py-3 font-display font-bold text-sm">
                      CONTINUER
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-display font-black text-xl">Confirmation finale</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Pour confirmer, saisis exactement : <b className="text-foreground">{CONFIRM_PHRASE}</b>
                  </p>
                  <input
                    autoFocus
                    value={phrase}
                    onChange={(e) => setPhrase(e.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    className="mt-4 w-full rounded-2xl bg-muted/40 border border-border px-4 py-3 font-display tracking-widest outline-none focus:border-destructive"
                  />
                  <button
                    disabled={phrase.trim().toUpperCase() !== CONFIRM_PHRASE || running}
                    onClick={execute}
                    className="mt-4 w-full rounded-2xl bg-destructive text-destructive-foreground py-4 font-display font-black tracking-wide disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "🔴"} CONFIRMER LA RÉINITIALISATION
                  </button>
                  <button onClick={close} disabled={running} className="mt-2 w-full py-2 text-xs text-muted-foreground">
                    Annuler
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
