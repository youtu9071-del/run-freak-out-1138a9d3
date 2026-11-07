import { describe, it, expect } from "vitest";
import { advanceGps, newGpsState } from "@/lib/gpsEngine";
import { analyzeSession, GpsPoint } from "@/lib/anticheat";
import { calculateFP } from "@/lib/freakPoints";

const fix = (x: number, y: number, t: number, accuracy = 5): GpsPoint => ({ lat: y / 111195, lng: x / 111195, timestamp: 100000 + t * 1000, accuracy });
describe("GPS accounting", () => {
  it("retains a 36m accuracy fix without blindly counting jitter", () => {
    const s = newGpsState(); advanceGps(s, fix(0, 0, 0, 36));
    expect(advanceGps(s, fix(1, 0, 2, 36)).distance).toBe(0);
    expect(advanceGps(s, fix(15, 0, 5, 36)).distance).toBeGreaterThan(0);
  });
  it("counts small real segments and preserves a turn", () => {
    const s = newGpsState(); advanceGps(s, fix(0, 0, 0, 2));
    const a = advanceGps(s, fix(1, 0, 1, 2));
    const b = advanceGps(s, fix(1, 1, 2, 2));
    expect((a.distance + b.distance) * 1000).toBeCloseTo(2, 2);
  });
  it("does not count an isolated teleport or the return jump", () => {
    const s = newGpsState(); advanceGps(s, fix(0, 0, 0));
    expect(advanceGps(s, fix(2000, 0, 1)).distance).toBe(0);
    expect(advanceGps(s, fix(4, 0, 2)).distance * 1000).toBeCloseTo(4, 2);
  });
  it("ignores duplicate/reversed timestamps and invalid coordinates", () => {
    const s = newGpsState(); advanceGps(s, fix(0, 0, 0));
    expect(advanceGps(s, fix(5, 0, 0)).quality).toBe("invalid");
    expect(advanceGps(s, fix(5, 0, -1)).distance).toBe(0);
    expect(advanceGps(s, { ...fix(5, 0, 1), lat: 91 }).quality).toBe("invalid");
  });
  it("reacquires after background suspension without inventing kilometres", () => {
    const s = newGpsState(); advanceGps(s, fix(0, 0, 0));
    expect(advanceGps(s, fix(100, 0, 120)).distance).toBe(0);
    expect(advanceGps(s, fix(104, 0, 122)).distance * 1000).toBeCloseTo(4, 2);
  });
  it("keeps very poor accuracy out of accounting and recovers", () => {
    const s = newGpsState(); advanceGps(s, fix(0, 0, 0));
    expect(advanceGps(s, fix(200, 0, 2, 100)).distance).toBe(0);
    expect(advanceGps(s, fix(10, 0, 4)).distance).toBe(0);
    expect(advanceGps(s, fix(14, 0, 6)).distance).toBeGreaterThan(0);
  });
  it("does not erase confirmed fraud or penalize a broken path", () => {
    expect(analyzeSession([], 0, 1, 60).isBlocked).toBe(true);
    expect(analyzeSession([{ ...fix(0, 0, 0), duelCounted: false }, { ...fix(2000, 0, 1), duelCounted: false }], 0, 0, 0).isBlocked).toBe(false);
  });
  it("preserves 0.5 FP per kilometre, never awards FP for steps", () => {
    expect(calculateFP(6.2, 0)).toEqual({ fpFromKm: 3.1, fpFromSteps: 0, totalFp: 3.1 });
    expect(calculateFP(0, 10000).totalFp).toBe(0);
  });
});