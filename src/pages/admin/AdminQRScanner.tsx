import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { QrCode, Check, X, AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminQRScanner() {
  const { user } = useAuth();
  const [scanInput, setScanInput] = useState("");
  const [scannedQR, setScannedQR] = useState<any>(null);
  const [qrList, setQrList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetchQRCodes();
  }, []);

  const fetchQRCodes = async () => {
    const { data } = await supabase
      .from("purchase_qrcodes")
      .select("*, product:products(name), buyer:profiles!purchase_qrcodes_user_id_fkey(username)")
      .order("created_at", { ascending: false })
      .limit(50);
    // Workaround: fetch profiles separately
    if (data) {
      const userIds = [...new Set(data.map(q => q.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
      const enriched = data.map(q => ({
        ...q,
        buyer_name: profiles?.find(p => p.user_id === q.user_id)?.username || "Inconnu",
      }));
      setQrList(enriched);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    if (!scanInput.trim()) return;
    // Try to parse QR data or find by ID
    try {
      const parsed = JSON.parse(scanInput);
      const found = qrList.find(q => {
        try {
          const qd = JSON.parse(q.qr_data);
          return qd.id === parsed.id;
        } catch { return false; }
      });
      setScannedQR(found || null);
      if (!found) toast.error("QR code non trouvé");
    } catch {
      const found = qrList.find(q => q.id === scanInput.trim());
      setScannedQR(found || null);
      if (!found) toast.error("QR code non trouvé");
    }
  };

  const handleValidate = async (qrId: string) => {
    if (!user) return;
    setValidating(true);
    const { error } = await supabase
      .from("purchase_qrcodes")
      .update({ status: "used", used_at: new Date().toISOString(), scanned_by: user.id })
      .eq("id", qrId);

    if (error) {
      toast.error("Erreur de validation");
    } else {
      toast.success("QR code validé ✅");
      setScannedQR(null);
      fetchQRCodes();
    }
    setValidating(false);
  };

  const statusInfo = (s: string) => {
    if (s === "active") return { icon: <Check className="w-4 h-4 text-primary" />, text: "Valide", cls: "border-primary/30 bg-primary/5" };
    if (s === "used") return { icon: <X className="w-4 h-4 text-muted-foreground" />, text: "Déjà utilisé", cls: "border-muted bg-secondary" };
    return { icon: <AlertTriangle className="w-4 h-4 text-destructive" />, text: "Expiré", cls: "border-destructive/30 bg-destructive/5" };
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-8 h-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Scanner Input */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" /> Scanner un QR Code
        </h3>
        <div className="flex gap-2">
          <Input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Collez les données du QR code..."
            className="flex-1"
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Scanned result */}
        {scannedQR && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`mt-4 rounded-xl border p-4 ${statusInfo(scannedQR.status).cls}`}>
            <div className="flex items-center gap-3 mb-3">
              {statusInfo(scannedQR.status).icon}
              <span className="font-bold text-sm">{statusInfo(scannedQR.status).text}</span>
            </div>
            <div className="space-y-1 text-sm">
              <p>Produit : <strong>{scannedQR.product?.name || "N/A"}</strong></p>
              <p>Acheteur : <strong>{scannedQR.buyer_name}</strong></p>
              <p>FP utilisés : <strong>{scannedQR.fp_used}</strong></p>
              <p>Réduction : <strong>{scannedQR.discount_amount}</strong></p>
              <p>Date : <strong>{new Date(scannedQR.created_at).toLocaleDateString("fr-FR")}</strong></p>
            </div>
            {scannedQR.status === "active" && (
              <Button onClick={() => handleValidate(scannedQR.id)} disabled={validating} className="w-full mt-3">
                <Check className="w-4 h-4 mr-2" /> {validating ? "Validation..." : "Valider le QR code"}
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* QR Codes list */}
      <div>
        <h3 className="font-bold text-sm mb-3">Tous les QR Codes ({qrList.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {qrList.map((qr) => {
            const st = statusInfo(qr.status);
            return (
              <button key={qr.id} onClick={() => setScannedQR(qr)}
                className={`w-full rounded-xl border p-3 flex items-center gap-3 text-left text-sm ${st.cls}`}>
                {st.icon}
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{qr.product?.name || "Produit"}</p>
                  <p className="text-xs text-muted-foreground">{qr.buyer_name} • {new Date(qr.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className="text-xs font-bold">{qr.fp_used} FP</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
