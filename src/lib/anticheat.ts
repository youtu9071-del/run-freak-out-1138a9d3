// Anti-Cheat Engine for FREAK OUT
// Détection de triche : vitesse, GPS, capteur de pas
// v2 : seuils relaxés + logs détaillés pour réduire les faux positifs

export type CheatLevel = "clean" | "suspect" | "fraud";

export interface CheatAlert {
  level: CheatLevel;
  reason: string;
  timestamp: number;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

// ─── Seuils de vitesse (running) ───
// Un sprinter élite atteint ~36 km/h ; un vélo peut monter au-delà.
// On est plus tolérant pour éviter les faux positifs GPS.
const SPEED_SUSPECT = 28;    // km/h — au-delà = suspect
const SPEED_FRAUD = 45;      // km/h — au-delà = fraude quasi-certaine (voiture)

const log = (...args: any[]) => {
  if (typeof window !== "undefined") console.log("[ANTICHEAT]", ...args);
};

// ─── Analyse de vitesse instantanée ───
export function analyzeSpeed(speedKmh: number): CheatAlert | null {
  if (!isFinite(speedKmh) || speedKmh <= 0) return null;
  if (speedKmh > SPEED_FRAUD) {
    log("fraud/speed", speedKmh);
    return { level: "fraud", reason: `Vitesse impossible : ${speedKmh.toFixed(1)} km/h`, timestamp: Date.now() };
  }
  if (speedKmh > SPEED_SUSPECT) {
    log("suspect/speed", speedKmh);
    return { level: "suspect", reason: `Vitesse élevée : ${speedKmh.toFixed(1)} km/h`, timestamp: Date.now() };
  }
  return null;
}

// ─── Distance Haversine ───
export function haversineDistance(p1: GpsPoint, p2: GpsPoint): number {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Saut GPS impossible ───
export function analyzeGpsJump(p1: GpsPoint, p2: GpsPoint): CheatAlert | null {
  const dist = haversineDistance(p1, p2);
  const timeDiffS = (p2.timestamp - p1.timestamp) / 1000;
  if (timeDiffS <= 0) return null;

  // Téléportation : >1 km en <2 s = fraude évidente
  if (dist > 1 && timeDiffS < 2) {
    log("fraud/teleport", { dist, timeDiffS });
    return { level: "fraud", reason: `Téléportation : ${(dist * 1000).toFixed(0)} m en ${timeDiffS.toFixed(0)} s`, timestamp: Date.now() };
  }

  const instantSpeed = dist / (timeDiffS / 3600);
  return analyzeSpeed(instantSpeed);
}

// ─── Trajectoire trop droite ───
export function analyzeTrajectory(points: GpsPoint[]): CheatAlert | null {
  if (points.length < 30) return null;
  let totalAngleChange = 0;
  for (let i = 2; i < points.length; i++) {
    const angle1 = Math.atan2(points[i - 1].lat - points[i - 2].lat, points[i - 1].lng - points[i - 2].lng);
    const angle2 = Math.atan2(points[i].lat - points[i - 1].lat, points[i].lng - points[i - 1].lng);
    totalAngleChange += Math.abs(angle2 - angle1);
  }
  const avg = totalAngleChange / (points.length - 2);
  if (avg < 0.005 && points.length > 60) {
    log("suspect/trajectory", avg);
    return { level: "suspect", reason: "Trajectoire anormalement droite", timestamp: Date.now() };
  }
  return null;
}

// ─── Pas vs distance ───
// Beaucoup de navigateurs n'exposent pas l'accéléromètre → steps=0.
// On ne pénalise que si des pas SONT détectés mais incohérents.
export function analyzeStepsVsDistance(steps: number, distanceKm: number): CheatAlert | null {
  if (distanceKm < 0.5) return null;
  if (steps === 0) return null; // pas de capteur : on ne rejette pas

  const expected = distanceKm * 1300;
  const ratio = steps / expected;

  if (ratio < 0.05) {
    log("fraud/steps", { steps, distanceKm, ratio });
    return { level: "fraud", reason: `Pas incohérents : ${steps} pour ${distanceKm.toFixed(2)} km`, timestamp: Date.now() };
  }
  if (ratio < 0.2) {
    log("suspect/steps", { steps, distanceKm, ratio });
    return { level: "suspect", reason: `Peu de pas : ${steps} pour ${distanceKm.toFixed(2)} km`, timestamp: Date.now() };
  }
  return null;
}

export interface SessionIntegrity {
  status: CheatLevel;
  alerts: CheatAlert[];
  confidence: number;
  speedVariance: number;
  isBlocked: boolean;
}

export function analyzeSession(
  gpsPoints: GpsPoint[],
  steps: number,
  totalDistanceKm: number,
  avgSpeed: number
): SessionIntegrity {
  const alerts: CheatAlert[] = [];

  const speedAlert = analyzeSpeed(avgSpeed);
  if (speedAlert) alerts.push(speedAlert);

  // Compter les vraies fraudes GPS (au moins 2 sauts pour confirmer)
  let gpsFraudCount = 0;
  for (let i = 1; i < gpsPoints.length; i++) {
    const a = analyzeGpsJump(gpsPoints[i - 1], gpsPoints[i]);
    if (a?.level === "fraud") gpsFraudCount++;
    if (a) alerts.push(a);
  }

  const trajAlert = analyzeTrajectory(gpsPoints);
  if (trajAlert) alerts.push(trajAlert);

  const stepAlert = analyzeStepsVsDistance(steps, totalDistanceKm);
  if (stepAlert) alerts.push(stepAlert);

  let speedVariance = 0;
  if (gpsPoints.length > 2) {
    const speeds: number[] = [];
    for (let i = 1; i < gpsPoints.length; i++) {
      const d = haversineDistance(gpsPoints[i - 1], gpsPoints[i]);
      const t = (gpsPoints[i].timestamp - gpsPoints[i - 1].timestamp) / 3600000;
      if (t > 0) speeds.push(d / t);
    }
    if (speeds.length > 1) {
      const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      speedVariance = speeds.reduce((acc, s) => acc + (s - mean) ** 2, 0) / speeds.length;
    }
    // Vitesse trop stable (comportement véhicule) : plus tolérant
    if (speedVariance < 0.2 && avgSpeed > 18 && gpsPoints.length > 60) {
      alerts.push({ level: "suspect", reason: "Vitesse trop régulière", timestamp: Date.now() });
    }
  }

  // Ne BLOQUER une session que si preuve claire :
  // - vitesse moyenne > seuil fraude, OU
  // - au moins 2 vrais sauts GPS impossibles, OU
  // - pas incohérents graves.
  const clearFraud =
    (avgSpeed > SPEED_FRAUD) ||
    (gpsFraudCount >= 2) ||
    alerts.some((a) => a.level === "fraud" && a.reason.startsWith("Pas incohérents"));

  const hasSuspect = alerts.some((a) => a.level === "suspect");
  const status: CheatLevel = clearFraud ? "fraud" : hasSuspect ? "suspect" : "clean";
  const confidence = clearFraud ? 10 : hasSuspect ? 65 : 95;

  log("session", { status, confidence, alerts: alerts.length, avgSpeed, distance: totalDistanceKm, steps, gpsPoints: gpsPoints.length });

  return { status, alerts, confidence, speedVariance, isBlocked: clearFraud };
}
