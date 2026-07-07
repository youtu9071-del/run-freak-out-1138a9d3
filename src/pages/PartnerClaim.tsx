import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PartnerClaim() {
  const { token } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user || !token) return;
    (async () => {
      const { error } = await supabase.rpc("claim_partner_invite" as any, { p_token: token });
      if (error) {
        setState("err");
        const m = error.message || "";
        setMsg(m.includes("EXPIRED") ? "Lien expiré" : m.includes("ALREADY_USED") ? "Lien déjà utilisé" : m.includes("INVALID") ? "Lien invalide" : "Erreur");
      } else {
        setState("ok");
      }
    })();
  }, [user, token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4">
        <ScanLine className="w-10 h-10 text-primary mx-auto" />
        <h1 className="font-display font-black text-2xl">Espace Partenaire</h1>
        {state === "loading" && <><Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" /><p className="text-sm">Activation…</p></>}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm">Compte partenaire activé.</p>
            <Button className="w-full gradient-primary" onClick={() => nav("/partner")}>Accéder au scanner</Button>
          </>
        )}
        {state === "err" && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{msg}</p>
          </>
        )}
      </div>
    </div>
  );
}
