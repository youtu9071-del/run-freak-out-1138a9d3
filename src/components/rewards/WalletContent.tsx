import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, Zap, Route, Footprints, TrendingUp, Clock, QrCode, Trash2, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

export default function WalletContent() {
  const { profile, user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [selectedQR, setSelectedQR] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    // Auto-expire old QR codes server-side, then fetch
    supabase.rpc("expire_old_qrcodes" as any).then(() => fetchData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    const [{ data: acts }, { data: qrs }] = await Promise.all([
      supabase.from("user_activities").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("purchase_qrcodes").select("*, product:products(name, image_url, currency, price)").eq("user_id", user.id).order("created_at", { ascending: false }),
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

  const downloadPDF = async (qr: any) => {
    try {
      const canvas = document.getElementById(`qr-pdf-${qr.id}`) as HTMLCanvasElement | null;
      if (!canvas) {
        toast.error("Erreur génération PDF");
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      pdf.setFontSize(20);
      pdf.text("FREAK OUT - Bon d'achat", 105, 25, { align: "center" });
      pdf.setFontSize(12);
      pdf.text(qr.product?.name || "Produit", 105, 40, { align: "center" });
      pdf.addImage(dataUrl, "PNG", 65, 55, 80, 80);
      pdf.setFontSize(10);
      pdf.text(`FP utilisés : ${qr.fp_used}`, 20, 150);
      pdf.text(`Réduction : ${Number(qr.discount_amount).toFixed(2)}`, 20, 158);
      pdf.text(`Total : ${Number(qr.total_price).toFixed(2)}`, 20, 166);
      pdf.text(`Émis le : ${new Date(qr.created_at).toLocaleDateString("fr-FR")}`, 20, 174);
      if (qr.expires_at) {
        pdf.text(`Expire le : ${new Date(qr.expires_at).toLocaleDateString("fr-FR")}`, 20, 182);
      }
      pdf.text(`Statut : ${qr.status}`, 20, 190);
      pdf.setFontSize(8);
      pdf.text("Présentez ce QR code à un administrateur pour récupérer votre produit.", 105, 210, { align: "center" });
      pdf.save(`qr-${qr.product?.name || "achat"}-${qr.id.slice(0, 8)}.pdf`);
      toast.success("PDF téléchargé");
    } catch (e) {
      toast.error("Erreur téléchargement");
    }
  };

  const totalFp = Number(profile?.total_fp || 0);
  const totalKm = Number(profile?.total_km || 0);
  const totalSteps = Number(profile?.total_steps || 0);

  const statusLabel = (s: string) => {
    if (s === "active") return { text: "Actif", cls: "text-primary bg-primary/10" };
    if (s === "used") return { text: "Utilisé", cls: "text-muted-foreground bg-secondary" };
    return { text: "Expiré", cls: "text-destructive bg-destructive/10" };
  };

  const daysLeft = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  };

  return (
    <div>
      {/* Hidden canvases used to generate PDFs */}
      <div style={{ position: "absolute", left: -9999, top: -9999 }}>
        {qrCodes.map((qr) => (
          <QRCodeCanvas key={`hidden-${qr.id}`} id={`qr-pdf-${qr.id}`} value={qr.qr_data} size={400} />
        ))}
      </div>

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
            const dl = daysLeft(qr.expires_at);
            return (
              <div key={qr.id} className="rounded-xl bg-card border border-border p-4 flex items-center gap-3">
                <button onClick={() => setSelectedQR(qr)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <QrCode className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm truncate">{qr.product?.name || "Produit"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(qr.created_at).toLocaleDateString("fr-FR")} • {qr.fp_used} FP
                    </p>
                    {qr.status === "active" && dl !== null && (
                      <p className="text-[10px] text-accent mt-0.5">
                        Expire dans {dl} jour{dl > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadPDF(qr); }}
                    className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline"
                  >
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              </div>
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
                <p className="text-muted-foreground">Réduction : <span className="font-bold text-foreground">{Number(selectedQR.discount_amount).toFixed(2)}</span></p>
                <p className="text-muted-foreground">Date : <span className="font-bold text-foreground">{new Date(selectedQR.created_at).toLocaleDateString("fr-FR")}</span></p>
                {selectedQR.expires_at && (
                  <p className="text-muted-foreground">Expire le : <span className="font-bold text-foreground">{new Date(selectedQR.expires_at).toLocaleDateString("fr-FR")}</span></p>
                )}
                <div className="mt-2">
                  {(() => {
                    const st = statusLabel(selectedQR.status);
                    return <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.cls}`}>{st.text}</span>;
                  })()}
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => downloadPDF(selectedQR)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-bold neon-glow"
                >
                  <Download className="w-3 h-3" /> Télécharger PDF
                </button>
                {selectedQR.status === "active" && (
                  <button
                    onClick={() => deleteQR(selectedQR.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-bold"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
