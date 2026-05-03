import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, AlertTriangle, QrCode, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";

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

export default function QRScan() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [qr, setQR] = useState<QRInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (uid) lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const lookup = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("scan_qrcode_lookup" as any, { p_uid: uid });
    if (error || !data || (data as any[]).length === 0) {
      setNotFound(true);
    } else {
      const row = (data as any[])[0] as QRInfo;
      setQR(row);
      if (row.status === "used") setAlreadyUsed(true);
    }
    setLoading(false);
  };

  const handleValidate = async () => {
    if (!isAdmin || !qr) return;
    setValidating(true);
    const { data, error } = await supabase.rpc("scan_qrcode_validate" as any, { p_uid: qr.qr_uid });
    if (error) {
      toast.error("Erreur de validation");
    } else {
      const row = (data as any[])?.[0];
      if (row?.already_used) {
        setAlreadyUsed(true);
        toast.error("⚠️ QR code déjà scanné !");
      } else {
        toast.success("QR code validé ✅");
        setQR({ ...qr, status: "used", used_at: row.used_at });
        setAlreadyUsed(true);
      }
    }
    setValidating(false);
  };

  const isExpired =
    qr?.expires_at && new Date(qr.expires_at) < new Date() && qr.status === "active";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (notFound || !qr) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="font-display font-black text-2xl text-center mb-2">QR Code introuvable</h1>
        <p className="text-sm text-muted-foreground text-center">Ce QR code n'existe pas ou a été supprimé.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-md mx-auto bg-background">
      <div className="flex items-center gap-2 mb-6">
        <QrCode className="w-6 h-6 text-primary" />
        <h1 className="font-display font-black text-xl">Scan QR Code</h1>
      </div>

      {/* Big alert if already used */}
      {alreadyUsed && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl bg-destructive/15 border-2 border-destructive p-6 mb-4 text-center"
        >
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
          <p className="font-display font-black text-2xl text-destructive">DÉJÀ SCANNÉ</p>
          {qr.used_at && (
            <p className="text-xs text-destructive/80 mt-1">
              Validé le {new Date(qr.used_at).toLocaleString("fr-FR")}
            </p>
          )}
        </motion.div>
      )}

      {!alreadyUsed && isExpired && (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-4 mb-4 text-center">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">QR code expiré</p>
        </div>
      )}

      {!alreadyUsed && !isExpired && qr.status === "active" && (
        <div className="rounded-2xl bg-primary/10 border border-primary/30 p-4 mb-4 text-center">
          <Check className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="font-display font-bold text-primary">QR code valide</p>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
        <Row label="Produit" value={qr.product_name || "—"} />
        <Row label="Acheteur" value={qr.buyer_name || "—"} />
        <Row label="FP utilisés" value={String(qr.fp_used)} />
        <Row label="Réduction" value={Number(qr.discount_amount).toFixed(2)} />
        <Row label="Total payé" value={Number(qr.total_price).toFixed(2)} />
        <Row label="Émis le" value={new Date(qr.created_at).toLocaleDateString("fr-FR")} />
        {qr.expires_at && (
          <Row label="Expire le" value={new Date(qr.expires_at).toLocaleDateString("fr-FR")} />
        )}
        <Row label="ID" value={qr.qr_uid} />
      </div>

      {/* Admin validate button */}
      {user && isAdmin && qr.status === "active" && !isExpired && !alreadyUsed && (
        <button
          onClick={handleValidate}
          disabled={validating}
          className="w-full mt-4 rounded-xl gradient-primary py-3 font-display font-bold text-primary-foreground neon-glow disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          {validating ? "Validation..." : "VALIDER LE QR CODE"}
        </button>
      )}

      {!user && (
        <p className="text-xs text-center text-muted-foreground mt-4">
          Connecte-toi en tant qu'administrateur pour valider ce QR code.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground truncate ml-2 max-w-[60%] text-right">{value}</span>
    </div>
  );
}
