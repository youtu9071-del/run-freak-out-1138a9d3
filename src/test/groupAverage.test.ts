import { describe, it, expect } from "vitest";
import { groupAverage } from "@/pages/Challenges";

const m = (min: number | null, completed = true) => ({
  user_id: String(Math.random()), username: "x", avatar_url: null,
  distance_km: 10, duration_seconds: min == null ? null : min * 60, completed,
});

describe("moyenne de groupe", () => {
  it("calcule 51 min 15 s pour 48/52/50/55 min", () => {
    expect(groupAverage([m(48), m(52), m(50), m(55)])).toBe(51.25 * 60);
  });
  it("ignore les participants encore en cours", () => {
    expect(groupAverage([m(45), m(49), m(30, false)])).toBe(47 * 60);
  });
  it("ne renvoie rien sans temps final", () => {
    expect(groupAverage([m(null, false)])).toBeNull();
  });
});
