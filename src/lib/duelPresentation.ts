export interface DuelParticipation {
  distance_km: number;
  duration_seconds: number;
  attempt_status: string;
  completed: boolean;
}

// A closed duel cannot have a live attempt, even in legacy expired records.
export function duelAttemptState(
  participation: DuelParticipation | null | undefined,
  duelStatus: string,
  queued = false,
): "closed_unfinished" | "finished" | "sync_pending" | "in_progress" | "not_started" {
  if (duelStatus === "completed") {
    return participation?.attempt_status === "finished" ? "finished" : "closed_unfinished";
  }
  if (queued) return "sync_pending";
  if (!participation) return "not_started";
  return participation.attempt_status === "in_progress" ? "in_progress" : "finished";
}