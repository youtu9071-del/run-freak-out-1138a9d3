import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { syncDuels } from "@/lib/duelSync";
import { syncActivities } from "@/lib/activitySync";

export default function DuelSync() {
  const { user, refreshProfile } = useAuth();
  useEffect(() => {
    if (!user) return;
    const sync = () => { void Promise.all([syncDuels(user.id), syncActivities(user.id)]).catch(() => {}); };
    const refresh = () => { void refreshProfile(); };
    sync();
    const interval = window.setInterval(sync, 15000);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("duel-sync", sync);
    window.addEventListener("duel-results-updated", refresh);
    window.addEventListener("activity-sync", sync);
    window.addEventListener("activity-results-updated", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("duel-sync", sync);
      window.removeEventListener("duel-results-updated", refresh);
      window.removeEventListener("activity-sync", sync);
      window.removeEventListener("activity-results-updated", refresh);
    };
  }, [user?.id]);
  return null;
}