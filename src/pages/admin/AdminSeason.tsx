import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Users, Route, Zap, AlertTriangle, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Overview = {
  season_number: number;
  season_started_at: string;
  users_count: number;
  total_km: number;
  total_fp: number;
  last_reset_at: string | null;
};

type Log = {
  id: string;
  created_at: string;
  season_from: number;
  season_to: number;
  users_affected: number;
  total_km_reset: number;
  total_fp_reset: number;
  fp_refunded: number;
  duels_settled: number;
  team_challenges_settled: number;
  result: string;
};

const CONFIRM_TEXT = "RESET SAISON";

export default function AdminSeason() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: o }, { data: l }] = await Promise.all([
      supabase.rpc("admin_season_overview"),
      supabase.from("season_reset_logs").select("*").order("created_at", { ascending: false }).limit(10),
    ]);
    setOv((o as any)?.[0] ?? null);
    setLogs((l as any) ?? []);
  };

  useEffect(() => { load(); }, []);

  const run = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_reset_season");
    setBusy(false);
    if (error) {
      toast.error("Échec de la réinitialisation : " + error.message);
      return;
    }
    const r: any = (data as any)?.[0];
    toast.success(
      `Saison ${r?.new_season} lancée — ${r?.users_affected} utilisateurs remis à zéro`
    );
    setStep(0);
    setTyped("");
    load();
  };

  const fmt = (n: any) => Number(n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="w-4 h-4 text-primary" />
          <h3 className="font-display font-black uppercase tracking-widest text-sm">Saison actuelle</h3>
        </div>

        <p className="font-display font-black text-3xl mb-4">SAISON {ov?.season_number ?? "—"}</p>

        <div className="grid gap-3 sm:grid-cols-3 mb-5">
          {[
            { i: Users, l: "Utilisateurs", v: fmt(ov?.users_count), c: "text-primary" },
            { i: Route, l: "KM de la saison", v: fmt(ov?.total_km), c: "text-primary" },
            { i: Zap, l: "Freak Points", v: fmt(ov?.total_fp), c: "text-accent" },
          ].map((c) => (
            <div key={c.l} className="rounded-xl bg-muted/30 border border-border p-4">
              <c.i className={`w-4 h-4 mb-2 ${c.c}`} />
              <p className="font-display font-black text-2xl">{c.v}</p>
              <p className="text-xs text-muted-foreground">{c.l}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep(1)}
          className="w-full rounded-xl bg-destructive/15 border border-destructive/40 text-destructive font-display font-bold uppercase tracking-widest text-xs py-3.5 hover:bg-destructive/25 transition-colors"
        >
          🔄 Réinitialiser la saison
        </button>

        <p className="text-xs text-muted-foreground mt-3">
          Dernière réinitialisation :{" "}
          {ov?.last_reset_at ? new Date(ov.last_reset_at).toLocaleString("fr-FR") : "Jamais"}
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-display font-black uppercase tracking-widest text-sm">Journal des réinitialisations</h3>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune réinitialisation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-xl bg-muted/20 border border-border p-3 text-xs">
                <p className="font-bold">
                  SAISON {l.season_from} → {l.season_to} · {new Date(l.created_at).toLocaleString("fr-FR")}
                </p>
                <p className="text-muted-foreground mt-1">
                  {l.users_affected} utilisateurs · {fmt(l.total_km_reset)} KM · {fmt(l.total_fp_reset)} FP remis à zéro
                </p>
                <p className="text-muted-foreground">
                  {l.duels_settled} duels et {l.team_challenges_settled} défis d'équipe clôturés ·{" "}
                  {fmt(l.fp_refunded)} FP restitués · {l.result}
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
              onClick={() => !busy && (setStep(0), setTyped(""))}
              className="fixed inset-0 bg-background/85 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-2xl bg-card border border-destructive/40 p-5"
            >
              <div className="flex items-center gap-2 mb-3 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-display font-black uppercase tracking-widest text-sm">
                  Réinitialisation de la saison
                </p>
              </div>

              {step === 1 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Cette action va remettre la progression de <b className="text-foreground">tous les utilisateurs</b> à zéro.
                  </p>
                  <div className="rounded-xl bg-muted/30 border border-border p-3 my-4 text-xs space-y-1">
                    <p>👥 Utilisateurs concernés : <b>{fmt(ov?.users_count)}</b></p>
                    <p>🏃 KM de la saison : <b>{fmt(ov?.total_km)} KM</b> → <b>0</b></p>
                    <p>⚡ FP actuels : <b>{fmt(ov?.total_fp)} FP</b> → <b>0</b></p>
                    <p>🏅 Niveaux : tous → <b>ROOKIE I</b></p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Les comptes, profils, rôles, historiques de courses et événements sont conservés. Les défis en cours
                    sont clôturés proprement et les mises bloquées restituées.
                  </p>
                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={() => setStep(0)}
                      className="flex-1 rounded-xl border border-border py-3 text-xs font-bold uppercase tracking-widest"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 rounded-xl bg-destructive/15 border border-destructive/40 text-destructive py-3 text-xs font-bold uppercase tracking-widest"
                    >
                      Continuer
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Pour confirmer, saisis exactement : <b className="text-foreground">{CONFIRM_TEXT}</b>
                  </p>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={CONFIRM_TEXT}
                    className="w-full mt-3 rounded-xl bg-muted/30 border border-border px-3 py-3 text-sm outline-none focus:border-destructive/60"
                  />
                  <div className="flex gap-2 mt-5">
                    <button
                      disabled={busy}
                      onClick={() => { setStep(0); setTyped(""); }}
                      className="flex-1 rounded-xl border border-border py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      disabled={typed.trim() !== CONFIRM_TEXT || busy}
                      onClick={run}
                      className="flex-1 rounded-xl bg-destructive text-destructive-foreground py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                      🔴 Confirmer
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
