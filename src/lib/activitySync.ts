import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

const KEY = "freakout_activity_outbox";
export type PendingActivity = TablesInsert<"user_activities"> & { id: string; user_id: string };
export function pendingActivities(): PendingActivity[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error("File de courses illisible");
  return entries;
}
export function queueActivity(activity: PendingActivity) {
  const entries = pendingActivities();
  if (!entries.some(a => a.id === activity.id)) localStorage.setItem(KEY, JSON.stringify([...entries, activity]));
  window.dispatchEvent(new Event("activity-sync"));
}
let syncing: Promise<void> | null = null;
export function syncActivities(userId: string): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    for (const item of pendingActivities().filter(a => a.user_id === userId)) {
      try {
        const { error } = await supabase.from("user_activities").insert(item);
        if (error) {
          if (error.code !== "23505") continue;
          const { data } = await supabase.from("user_activities").select("id,user_id").eq("id", item.id).maybeSingle();
          if (!data || data.user_id !== userId) continue;
        }
        localStorage.setItem(KEY, JSON.stringify(pendingActivities().filter(a => a.id !== item.id)));
        window.dispatchEvent(new Event("activity-results-updated"));
      } catch { /* Keep the durable item until the server acknowledges it. */ }
    }
  })().finally(() => { syncing = null; });
  return syncing;
}