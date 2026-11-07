import { GpsPoint, haversineDistance } from "./anticheat";

export interface RunPoint extends GpsPoint { duelCounted: boolean }
export interface GpsEngineState {
  lastTimestamp: number;
  anchor: GpsPoint | null;
  pending: GpsPoint[];
  outlier: GpsPoint | null;
}
export const newGpsState = (): GpsEngineState => ({ lastTimestamp: 0, anchor: null, pending: [], outlier: null });
export function validFix(p: GpsPoint) {
  return [p.lat, p.lng, p.timestamp, p.accuracy].every(Number.isFinite) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && p.timestamp > 0 && p.accuracy > 0;
}
const plausible = (a: GpsPoint, b: GpsPoint) => {
  const seconds = (b.timestamp - a.timestamp) / 1000;
  const metres = haversineDistance(a, b) * 1000;
  const uncertainty = Math.hypot(a.accuracy, b.accuracy);
  return seconds > 0 && metres / seconds <= 12.5 && (metres - uncertainty) / seconds <= 12.5;
};
/** Raw fixes are retained separately. No smoothing of the geometry used for accounting.
 * Short segments are buffered, then committed together, preserving turns and timestamps.
 * Gaps >30s, low precision and relocations break the path: never invent the missing route. */
export function advanceGps(state: GpsEngineState, point: GpsPoint): { distance: number; points: RunPoint[]; quality: "good" | "weak" | "invalid" } {
  if (!validFix(point) || point.timestamp <= state.lastTimestamp) return { distance: 0, points: [], quality: "invalid" };
  state.lastTimestamp = point.timestamp;
  if (point.accuracy > 50) {
    state.anchor = null; state.pending = []; state.outlier = null;
    return { distance: 0, points: [{ ...point, duelCounted: false }], quality: "weak" };
  }
  if (!state.anchor || point.timestamp - state.anchor.timestamp > 30000) {
    state.anchor = point; state.pending = []; state.outlier = null;
    return { distance: 0, points: [{ ...point, duelCounted: false }], quality: point.accuracy > 20 ? "weak" : "good" };
  }
  const previous = state.pending.at(-1) ?? state.anchor;
  if (!plausible(previous, point)) {
    // An isolated teleport does not replace the trusted anchor. Two consistent
    // remote fixes allow reacquisition, but the teleport is never counted.
    if (state.outlier && plausible(state.outlier, point)) {
      state.anchor = point; state.pending = []; state.outlier = null;
      return { distance: 0, points: [{ ...point, duelCounted: false }], quality: "weak" };
    }
    state.outlier = point;
    return { distance: 0, points: [], quality: "weak" };
  }
  state.outlier = null;
  state.pending.push(point);
  const uncertainty = Math.hypot(state.anchor.accuracy, point.accuracy);
  const noise = Math.max(0.8, Math.min(10, uncertainty * (point.accuracy <= 20 ? 0.15 : 0.5)));
  const displacement = haversineDistance(state.anchor, point) * 1000;
  let previousPoint = state.anchor;
  const path = state.pending.reduce((sum, p) => { const d = haversineDistance(previousPoint, p); previousPoint = p; return sum + d; }, 0);
  // A wandering cloud of fixes must not become distance. Limit path inflation.
  if (displacement < noise || path * 1000 > Math.max(displacement * 1.8, noise * 2)) {
    if (point.timestamp - state.anchor.timestamp >= 15000 || state.pending.length >= 20) {
      state.anchor = point; state.pending = [];
      return { distance: 0, points: [{ ...point, duelCounted: false }], quality: "weak" };
    }
    return { distance: 0, points: [], quality: point.accuracy > 20 ? "weak" : "good" };
  }
  const points = state.pending.map(p => ({ ...p, duelCounted: true }));
  state.anchor = point; state.pending = [];
  return { distance: path, points, quality: point.accuracy > 20 ? "weak" : "good" };
}