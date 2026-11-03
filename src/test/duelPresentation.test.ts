import { describe, expect, it } from "vitest";
import { duelAttemptState, type DuelParticipation } from "@/lib/duelPresentation";

const started: DuelParticipation = { distance_km: 0, duration_seconds: 0, attempt_status: "in_progress", completed: false };

describe("1V1 terminal participation state", () => {
  it("does not treat a legacy attempt as active after duel closure", () => {
    expect(duelAttemptState(started, "completed")).toBe("closed_unfinished");
  });
  it("closes an unstarted attempt when the duel is completed", () => {
    expect(duelAttemptState(null, "completed")).toBe("closed_unfinished");
  });
  it("preserves a submitted result after closure", () => {
    expect(duelAttemptState({ ...started, attempt_status: "finished", distance_km: 0.32, duration_seconds: 219 }, "completed")).toBe("finished");
  });
  it("does not hide an active attempt before closure", () => {
    expect(duelAttemptState(started, "accepted")).toBe("in_progress");
  });
  it("keeps offline synchronization pending on an active duel", () => {
    expect(duelAttemptState(started, "accepted", true)).toBe("sync_pending");
  });
  it("gives the persisted terminal duel precedence over a stale queue", () => {
    expect(duelAttemptState(started, "completed", true)).toBe("closed_unfinished");
  });
});