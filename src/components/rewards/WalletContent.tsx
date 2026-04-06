import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, Zap, Route, Footprints, TrendingUp, Clock, QrCode, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function WalletContent() {
  const { profile, user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [selectedQR, setSelectedQR] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: acts }, { data: qrs }] = await Promise.all([
      supabase.from("user_activities").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("purchase_qrcodes").select("*, product:products(name, image_url, currency)").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (acts) setActivities(acts);
    if (qrs) setQrCodes(qrs);
  };

  const deleteQR = async (id: string) => {
    await supabase.from("purchase_qrcodes").delete().eq("id", id);
    setQrCodes(prev => prev.filter(q => q.id !== id));
    setSelectedQR(null);
    toast.success("QR code supprimé");
  };

  const totalFp = Number(profile?.total_fp || 0);
  const totalKm = Number(profile?.total_km || 0);
  const totalSteps = Number(profile?.total_steps || 0);

  const statusLabel = (s: string) => {
    if (s === "active") return { text: "Actif", cls: "text-primary bg-primary/10" };
    if (s === "used") return { text: "Utilisé", cls: "text-muted-foreground bg-secondary" };
    return { text: "Expiré", cls: "text-destructive bg-destructive/10" };
  };

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

      {/* QR Codes Section */}
      <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
        <QrCode className="w-5 h-5 text-primary" /> Mes QR Codes
      </h2>
      {qrCodes.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-6 text-center mb-6">
          <QrCode className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun QR code</p>
          <p className="text-xs text-muted-foreground">Achetez un produit pour obtenir un QR code</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {qrCodes.map((qr) => {
            const st = statusLabel(qr.status);
            return (
              <button key={qr.id} onClick={() => setSelectedQR(qr)}
                className="w-full rounded-xl bg-card border border-border p-4 flex items-center gap-3 text-left">
                <QrCode className="w-8 h-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm truncate">{qr.product?.name || "Produit"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(qr.created_at).toLocaleDateString("fr-FR")} • {qr.fp_used} FP
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
              </button>
            );
          })}
        </div>
      )}

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

      {/* QR Detail Dialog */}
      <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> {selectedQR?.product?.name || "QR Code"}
            </DialogTitle>
          </DialogHeader>
          {selectedQR && (
            <div className="space-y-4 text-center">
              <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                <QRCodeSVG value={selectedQR.qr_data} size={200} />
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">FP utilisés : <span className="font-bold text-foreground">{selectedQR.fp_used}</span></p>
                <p className="text-muted-foreground">Réduction : <span className="font-bold text-foreground">{selectedQR.discount_amount}</span></p>
                <p className="text-muted-foreground">Date : <span className="font-bold text-foreground">{new Date(selectedQR.created_at).toLocaleDateString("fr-FR")}</span></p>
                <div className="mt-2">
                  {(() => {
                    const st = statusLabel(selectedQR.status);
                    return <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.cls}`}>{st.text}</span>;
                  })()}
                </div>
              </div>
              {selectedQR.status === "active" && (
                <button onClick={() => deleteQR(selectedQR.id)}
                  className="flex items-center gap-2 mx-auto text-destructive text-xs font-bold">
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
