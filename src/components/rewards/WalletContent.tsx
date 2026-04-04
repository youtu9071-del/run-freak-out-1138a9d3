import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, Zap, Route, Footprints, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function WalletContent() {
  const { profile, user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_activities").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setActivities(data); });
  }, [user]);

  const totalFp = Number(profile?.total_fp || 0);
  const totalKm = Number(profile?.total_km || 0);
  const totalSteps = Number(profile?.total_steps || 0);

  return (
    <div>
      {/* Main FP Card */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl gradient-primary p-6 mb-6 neon-glow-strong relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/10 -translate-y-8 translate-x-8" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-primary-foreground/80" />
            <p className="text-sm font-medium text-primary-foreground/80">Freak Points (FP)</p>
          </div>
          <p className="font-display font-black text-5xl text-primary-foreground mb-1">{totalFp.toFixed(1)}</p>
          <p className="text-xs text-primary-foreground/60">Points accumulés</p>
        </div>
      </motion.div>

      {/* Conversions */}
      <div className="rounded-2xl bg-card border border-border p-4 mb-6">
        <h3 className="font-display font-bold text-sm mb-3">Conversions</h3>
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl bg-secondary/50 p-3 text-center">
            <Route className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="font-display font-bold text-lg">10 km</p>
            <p className="text-xs text-muted-foreground">= 5 FP</p>
          </div>
          <div className="flex-1 rounded-xl bg-secondary/50 p-3 text-center">
            <Footprints className="w-5 h-5 text-accent mx-auto mb-1" />
            <p className="font-display font-bold text-lg">1 000 pas</p>
            <p className="text-xs text-muted-foreground">= 2 FP</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl bg-card border border-border p-4">
          <Route className="w-4 h-4 text-primary mb-1" />
          <p className="font-display font-bold text-lg">{totalKm.toFixed(1)} km</p>
          <p className="text-[10px] text-muted-foreground">→ {((totalKm / 10) * 5).toFixed(1)} FP</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <Footprints className="w-4 h-4 text-accent mb-1" />
          <p className="font-display font-bold text-lg">{totalSteps.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">→ {((totalSteps / 1000) * 2).toFixed(1)} FP</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <TrendingUp className="w-4 h-4 text-primary mb-1" />
          <p className="font-display font-bold text-lg">{profile?.total_activities || 0}</p>
          <p className="text-[10px] text-muted-foreground">Activités</p>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <Zap className="w-4 h-4 text-accent mb-1" />
          <p className="font-display font-bold text-lg">{totalFp.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">FP totaux</p>
        </div>
      </div>

      {/* History */}
      <h2 className="font-display font-bold text-lg mb-3">Historique FP</h2>
      {activities.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center">
          <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucune activité encore</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((act) => (
            <div key={act.id} className="rounded-xl bg-card border border-border p-4 flex items-center justify-between">
              <div>
                <p className="font-display font-semibold text-sm">{Number(act.distance_km).toFixed(2)} km · {act.steps} pas</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(act.created_at).toLocaleDateString("fr-FR")} · {Math.round(act.duration_seconds / 60)} min
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${act.integrity_status === "fraud" ? "text-destructive line-through" : "text-primary"}`}>+{Number(act.total_fp).toFixed(1)} FP</p>
                <p className="text-[10px] text-muted-foreground">{Number(act.fp_from_km).toFixed(1)} km + {Number(act.fp_from_steps).toFixed(1)} pas</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
