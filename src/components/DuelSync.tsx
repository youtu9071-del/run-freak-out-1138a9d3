import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { syncDuels } from "@/lib/duelSync";

export default function DuelSync() {
  const { user, refreshProfile } = useAuth();
  useEffect(() => {
    if (!user) return;
    const sync = () => { void syncDuels(user.id); };
    const refresh = () => { void refreshProfile(); };
    sync();
    const interval = window.setInterval(sync, 15000);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("duel-sync", sync);
    window.addEventListener("duel-results-updated", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("duel-sync", sync);
      window.removeEventListener("duel-results-updated", refresh);
    };
  }, [user?.id]);
  return null;
}