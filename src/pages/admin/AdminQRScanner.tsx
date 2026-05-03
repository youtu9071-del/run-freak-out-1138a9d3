import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { QrCode, Check, X, AlertTriangle, Search, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminQRScanner() {
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
      .select("*, product:products(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      const userIds = [...new Set(data.map((q: any) => q.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username")
        .in("user_id", userIds);
      const enriched = data.map((q: any) => ({
        ...q,
        buyer_name: profiles?.find((p: any) => p.user_id === q.user_id)?.username || "Inconnu",
      }));
      setQrList(enriched);
    }
    setLoading(false);
  };

  const extractUid = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // Accept full URL like https://.../scan/<uid>
    const match = trimmed.match(/scan\/([a-f0-9]+)/i);
    if (match) return match[1];
    // Otherwise treat raw input as UID (legacy or already extracted)
    return trimmed;
  };

  const handleSearch = async () => {
    const uid = extractUid(scanInput);
    if (!uid) return;
    const found = qrList.find((q: any) => q.qr_uid === uid || q.id === uid);
    if (found) {
      setScannedQR(found);
    } else {
      // Try server lookup
      const { data } = await supabase.rpc("scan_qrcode_lookup" as any, { p_uid: uid });
      if (data && (data as any[]).length > 0) {
        setScannedQR((data as any[])[0]);
      } else {
        setScannedQR(null);
        toast.error("QR code non trouvé");
      }
    }
  };

  const handleValidate = async (qr: any) => {
    setValidating(true);
    const uid = qr.qr_uid || qr.id;
    const { data, error } = await supabase.rpc("scan_qrcode_validate" as any, { p_uid: uid });
    if (error) {
      toast.error("Erreur de validation");
    } else {
      const row = (data as any[])?.[0];
      if (row?.already_used) {
        toast.error("⚠️ QR code déjà scanné !");
      } else {
        toast.success("QR code validé ✅");
      }
      setScannedQR(null);
      fetchQRCodes();
    }
    setValidating(false);
  };

  const copyLink = (qr: any) => {
    const url = `${window.location.origin}/scan/${qr.qr_uid}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  const statusInfo = (s: string) => {
    if (s === "active")
      return { icon: <Check className="w-4 h-4 text-primary" />, text: "Valide", cls: "border-primary/30 bg-primary/5" };
    if (s === "used")
      return { icon: <X className="w-4 h-4 text-muted-foreground" />, text: "Déjà utilisé", cls: "border-muted bg-secondary" };
    return { icon: <AlertTriangle className="w-4 h-4 text-destructive" />, text: "Expiré", cls: "border-destructive/30 bg-destructive/5" };
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card border border-border p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary" /> Scanner un QR Code
        </h3>
        <div className="flex gap-2">
          <Input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Collez le lien ou l'ID du QR code..."
            className="flex-1"
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Astuce : scannez le QR code avec votre téléphone, ouvrez le lien <code>/scan/...</code> et validez sur cette page.
        </p>

        {scannedQR && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 rounded-xl border p-4 ${statusInfo(scannedQR.status).cls}`}
          >
            <div className="flex items-center gap-3 mb-3">
              {statusInfo(scannedQR.status).icon}
              <span className="font-bold text-sm">{statusInfo(scannedQR.status).text}</span>
            </div>
            <div className="space-y-1 text-sm">
              <p>Produit : <strong>{scannedQR.product?.name || scannedQR.product_name || "N/A"}</strong></p>
              <p>Acheteur : <strong>{scannedQR.buyer_name || "Inconnu"}</strong></p>
              <p>FP utilisés : <strong>{scannedQR.fp_used}</strong></p>
              <p>Réduction : <strong>{scannedQR.discount_amount}</strong></p>
              <p>Date : <strong>{new Date(scannedQR.created_at).toLocaleDateString("fr-FR")}</strong></p>
              <p className="text-xs text-muted-foreground">UID : {scannedQR.qr_uid || scannedQR.id}</p>
            </div>
            {scannedQR.status === "active" && (
              <Button
                onClick={() => handleValidate(scannedQR)}
                disabled={validating}
                className="w-full mt-3"
              >
                <Check className="w-4 h-4 mr-2" /> {validating ? "Validation..." : "Valider le QR code"}
              </Button>
            )}
            {scannedQR.status === "used" && (
              <div className="mt-3 rounded-lg bg-destructive/10 border border-destructive p-3 text-center">
                <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
                <p className="text-xs font-bold text-destructive">DÉJÀ SCANNÉ</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div>
        <h3 className="font-bold text-sm mb-3">Tous les QR Codes ({qrList.length})</h3>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto">
          {qrList.map((qr) => {
            const st = statusInfo(qr.status);
            return (
              <div key={qr.id} className={`rounded-xl border p-3 flex items-center gap-3 text-sm ${st.cls}`}>
                <button onClick={() => setScannedQR(qr)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {st.icon}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{qr.product?.name || "Produit"}</p>
                    <p className="text-xs text-muted-foreground">
                      {qr.buyer_name} • {new Date(qr.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className="text-xs font-bold">{qr.fp_used} FP</span>
                </button>
                {qr.qr_uid && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => copyLink(qr)}
                      className="text-[10px] flex items-center gap-1 text-primary hover:underline"
                      title="Copier le lien"
                    >
                      <Copy className="w-3 h-3" /> Lien
                    </button>
                    <a
                      href={`/scan/${qr.qr_uid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Ouvrir
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
