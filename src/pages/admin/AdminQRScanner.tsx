import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Check, X, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface QRInfo {
  id: string;
  qr_uid: string;
  status: string;
  product_name: string | null;
  buyer_name: string | null;
  fp_used: number;
  discount_amount: number;
  total_price: number;
  created_at: string;
  used_at: string | null;
  expires_at: string | null;
}

const READER_ID = "admin-qr-reader";

export default function AdminQRScanner() {
  const [scanning, setScanning] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<QRInfo | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  const extractUid = (raw: string): string | null => {
    const t = raw.trim();
    if (!t) return null;
    const m = t.match(/scan\/([a-zA-Z0-9]+)/);
    return m ? m[1] : t;
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      try { await scannerRef.current.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { stopScanner(); }, []);

  const handleDecoded = async (decoded: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const uid = extractUid(decoded);
    if (!uid) { busyRef.current = false; return; }

    await stopScanner();
    setLoadingLookup(true);
    const { data, error } = await supabase.rpc("scan_qrcode_lookup" as any, { p_uid: uid });
    setLoadingLookup(false);
    busyRef.current = false;

    if (error || !data || (data as any[]).length === 0) {
      toast.error("QR code introuvable");
      return;
    }
    setResult((data as any[])[0] as QRInfo);
  };

  const startScanner = async () => {
    setResult(null);
    setScanning(true);
    // Wait for DOM node to mount
    setTimeout(async () => {
      try {
        const html5Qrcode = new Html5Qrcode(READER_ID);
        scannerRef.current = html5Qrcode;
        await html5Qrcode.start(
          { facingMode: { exact: "environment" } as any },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => { void handleDecoded(decoded); },
          () => { /* ignore per-frame decode errors */ }
        ).catch(async () => {
          // Fallback if exact:environment fails
          await html5Qrcode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 260, height: 260 } },
            (decoded) => { void handleDecoded(decoded); },
            () => {}
          );
        });
      } catch (e: any) {
        toast.error("Impossible d'ouvrir la caméra : " + (e?.message || "erreur"));
        setScanning(false);
      }
    }, 100);
  };

  const validate = async () => {
    if (!result) return;
    setValidating(true);
    const { data, error } = await supabase.rpc("scan_qrcode_validate" as any, { p_uid: result.qr_uid });
    setValidating(false);
    if (error) { toast.error("Erreur de validation"); return; }
    const row = (data as any[])?.[0];
    if (row?.already_used) {
      toast.error("⚠️ QR code déjà scanné !");
      setResult({ ...result, status: "used", used_at: row.used_at });
    } else {
      toast.success("✅ QR code validé");
      setResult({ ...result, status: "used", used_at: new Date().toISOString() });
    }
  };

  const isExpired =
    result?.expires_at && new Date(result.expires_at) < new Date() && result.status === "active";

  const statusBadge = () => {
    if (!result) return null;
    if (result.status === "used") return { label: "DÉJÀ UTILISÉ", cls: "bg-destructive/15 border-destructive text-destructive", icon: <X className="w-5 h-5" /> };
    if (isExpired || result.status === "expired") return { label: "EXPIRÉ", cls: "bg-accent/15 border-accent text-accent", icon: <AlertTriangle className="w-5 h-5" /> };
    return { label: "VALIDE", cls: "bg-primary/15 border-primary text-primary", icon: <Check className="w-5 h-5" /> };
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <QrCode className="w-8 h-8 text-primary mx-auto mb-1" />
        <h2 className="font-display font-black text-xl">Scanner un QR Code</h2>
        <p className="text-xs text-muted-foreground">Caméra arrière — validation unique</p>
      </div>

      {!scanning && !result && !loadingLookup && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            onClick={startScanner}
            className="w-full h-14 text-base gradient-primary neon-glow"
          >
            <Camera className="w-5 h-5 mr-2" />
            Scanner un QR Code
          </Button>
        </motion.div>
      )}

      {scanning && (
        <div className="rounded-2xl overflow-hidden border-2 border-primary/40 bg-black relative">
          <div id={READER_ID} className="w-full" />
          <div className="p-3 flex justify-center">
            <Button variant="secondary" size="sm" onClick={stopScanner}>Annuler</Button>
          </div>
        </div>
      )}

      {loadingLookup && (
        <div className="rounded-2xl bg-card border border-border p-6 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Lecture du QR code…</span>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-card border border-border p-5 space-y-4"
          >
            {(() => {
              const b = statusBadge();
              return b ? (
                <div className={`rounded-xl border-2 px-3 py-2 flex items-center gap-2 font-display font-black ${b.cls}`}>
                  {b.icon}
                  <span>{b.label}</span>
                </div>
              ) : null;
            })()}

            <div className="space-y-2 text-sm">
              <Row label="Produit" value={result.product_name || "—"} />
              <Row label="Utilisateur" value={result.buyer_name || "—"} />
              <Row label="FP utilisés" value={String(result.fp_used)} />
              <Row label="Réduction" value={Number(result.discount_amount).toFixed(2)} />
              <Row label="Total payé" value={Number(result.total_price).toFixed(2)} />
              <Row label="Émis le" value={new Date(result.created_at).toLocaleString("fr-FR")} />
              {result.used_at && (
                <Row label="Validé le" value={new Date(result.used_at).toLocaleString("fr-FR")} />
              )}
            </div>

            {result.status === "active" && !isExpired && (
              <Button onClick={validate} disabled={validating} className="w-full gradient-primary">
                <Check className="w-4 h-4 mr-2" />
                {validating ? "Validation…" : "Valider le QR code"}
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setResult(null); startScanner(); }}
            >
              <Camera className="w-4 h-4 mr-2" />
              Scanner un autre code
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] text-center text-muted-foreground">
        Chaque QR code ne peut être validé qu'une seule fois.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground truncate ml-2 max-w-[60%] text-right">{value}</span>
    </div>
  );
}
