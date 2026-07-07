import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsPartner(false); setLoading(false); return; }
    (async () => {
      const [{ data: admin }, { data: partner }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" as any }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "partner" as any }),
      ]);
      setIsAdmin(!!admin);
      setIsPartner(!!partner);
      setLoading(false);
    })();
  }, [user]);

  return { isAdmin, isPartner, loading };
}
