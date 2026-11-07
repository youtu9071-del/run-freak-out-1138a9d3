import { supabase } from "@/integrations/supabase/client";

export const DUEL_CONTEXT_KEY = "freakout_duel_context";
const QUEUE_KEY = "freakout_duel_finalizations";
export interface DuelContext { id: string; distance: number; userId: string; startedAt?: number }
export interface PendingDuel {
  inviteId: string;
  activityId: string;
  userId: string;
  startedAt: number;
  run: Record<string, unknown>;
}
export function readDuelContext(): DuelContext | null {
  try {
    const raw = localStorage.getItem(DUEL_CONTEXT_KEY) || sessionStorage.getItem("active_duel");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function pendingDuels(): PendingDuel[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
export function queueDuel(item: PendingDuel) {
  const queue = pendingDuels();
  if (!queue.some(p => p.inviteId === item.inviteId && p.userId === item.userId)) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, item]));
  }
  localStorage.removeItem(DUEL_CONTEXT_KEY);
  sessionStorage.removeItem("active_duel");
  window.dispatchEvent(new Event("duel-sync"));
}
let syncing: Promise<void> | null = null;
export function syncDuels(userId: string): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    for (const item of pendingDuels().filter(p => p.userId === userId)) {
      try {
      const { error } = await supabase.rpc("finalize_duel_activity" as any, {
        p_invite_id: item.inviteId, p_activity_id: item.activityId,
        p_started_at: item.startedAt, p_run: item.run,
      });
      if (error) continue; // Never lose an unacknowledged finalization.
      const { data: part } = await supabase.from("duel_participations").select("activity_id,attempt_status")
        .eq("invite_id", item.inviteId).eq("user_id", userId).maybeSingle();
      if (!part || part.attempt_status !== "finished" || part.activity_id !== item.activityId) continue;
      localStorage.setItem(QUEUE_KEY, JSON.stringify(pendingDuels().filter(p => p.activityId !== item.activityId)));
      window.dispatchEvent(new Event("duel-results-updated"));
      } catch { /* Transport failures do not discard the saved run. */ }
    }
  })().finally(() => { syncing = null; });
  return syncing;
}