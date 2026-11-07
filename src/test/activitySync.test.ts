import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), rpc: vi.fn(), part: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => ({ insert: mocks.insert, select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.part }), maybeSingle: mocks.part }) }) }),
} }));
import { queueActivity, syncActivities, pendingActivities } from "@/lib/activitySync";
import { queueDuel, syncDuels, pendingDuels } from "@/lib/duelSync";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); });
describe("durable activity outboxes", () => {
  it("retries a normal offline run with the same unique ID", async () => {
    queueActivity({ id: "a", user_id: "u", distance_km: 6.2 });
    queueActivity({ id: "a", user_id: "u", distance_km: 6.2 });
    mocks.insert.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ error: null });
    await syncActivities("u"); expect(pendingActivities()).toHaveLength(1);
    await syncActivities("u"); expect(pendingActivities()).toHaveLength(0);
    expect(mocks.insert.mock.calls.map(c => c[0].id)).toEqual(["a", "a"]);
  });
  it("keeps a duel run on RPC failure and acknowledges only the linked ID", async () => {
    queueDuel({ inviteId: "d", activityId: "a", userId: "u", startedAt: 1, run: { distance_km: 6.2 } });
    mocks.rpc.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ error: null });
    await syncDuels("u"); expect(pendingDuels()).toHaveLength(1);
    mocks.part.mockResolvedValueOnce({ data: { activity_id: "wrong", attempt_status: "finished" } });
    await syncDuels("u"); expect(pendingDuels()).toHaveLength(1);
    mocks.part.mockResolvedValueOnce({ data: { activity_id: "a", attempt_status: "finished" } });
    await syncDuels("u"); expect(pendingDuels()).toHaveLength(0);
  });
  it("never sends a different user's queued activity", async () => {
    queueActivity({ id: "a", user_id: "u" });
    await syncActivities("other"); expect(mocks.insert).not.toHaveBeenCalled();
  });
});