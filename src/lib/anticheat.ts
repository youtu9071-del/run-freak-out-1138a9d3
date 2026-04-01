// Anti-Cheat Engine for FREAK OUT
// Détection de triche : vitesse, GPS, capteur de pas

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

// ─── Seuils de vitesse ───
const SPEED_NORMAL_MAX = 15; // km/h
const SPEED_SUSPECT = 20;    // km/h
const SPEED_FRAUD = 30;      // km/h

// ─── Analyse de vitesse instantanée ───
export function analyzeSpeed(speedKmh: number): CheatAlert | null {
  if (speedKmh > SPEED_FRAUD) {
    return { level: "fraud", reason: `Vitesse impossible : ${speedKmh.toFixed(1)} km/h (> ${SPEED_FRAUD})`, timestamp: Date.now() };
  }
  if (speedKmh > SPEED_SUSPECT) {
    return { level: "suspect", reason: `Vitesse suspecte : ${speedKmh.toFixed(1)} km/h`, timestamp: Date.now() };
  }
  return null;
}

// ─── Calcul distance entre 2 points GPS (Haversine) ───
export function haversineDistance(p1: GpsPoint, p2: GpsPoint): number {
  const R = 6371; // km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Détection de saut GPS impossible ───
export function analyzeGpsJump(p1: GpsPoint, p2: GpsPoint): CheatAlert | null {
  const dist = haversineDistance(p1, p2);
  const timeDiffH = (p2.timestamp - p1.timestamp) / 3600000;
  if (timeDiffH <= 0) return null;

  const instantSpeed = dist / timeDiffH;

  // Saut de position instantané (>500m en <2s)
  const timeDiffS = (p2.timestamp - p1.timestamp) / 1000;
  if (dist > 0.5 && timeDiffS < 2) {
    return { level: "fraud", reason: `Téléportation détectée : ${(dist * 1000).toFixed(0)}m en ${timeDiffS.toFixed(0)}s`, timestamp: Date.now() };
  }

  return analyzeSpeed(instantSpeed);
}

// ─── Analyse de trajectoire (ligne droite = suspect) ───
export function analyzeTrajectory(points: GpsPoint[]): CheatAlert | null {
  if (points.length < 10) return null;

  // Calcul de la variance directionnelle
  let totalAngleChange = 0;
  for (let i = 2; i < points.length; i++) {
    const angle1 = Math.atan2(points[i - 1].lat - points[i - 2].lat, points[i - 1].lng - points[i - 2].lng);
    const angle2 = Math.atan2(points[i].lat - points[i - 1].lat, points[i].lng - points[i - 1].lng);
    totalAngleChange += Math.abs(angle2 - angle1);
  }

  const avgAngleChange = totalAngleChange / (points.length - 2);

  // Trajectoire trop parfaite (presque pas de changement de direction)
  if (avgAngleChange < 0.01 && points.length > 20) {
    return { level: "suspect", reason: "Trajectoire anormalement droite", timestamp: Date.now() };
  }

  return null;
}

// ─── Vérification capteur de pas vs distance GPS ───
export function analyzeStepsVsDistance(steps: number, distanceKm: number): CheatAlert | null {
  if (distanceKm < 0.1) return null; // Pas assez de données

  // ~1300 pas/km en moyenne pour la course
  const expectedSteps = distanceKm * 1300;
  const ratio = steps / expectedSteps;

  if (ratio < 0.1) {
    return { level: "fraud", reason: `Pas détectés: ${steps} pour ${distanceKm.toFixed(2)}km (attendu: ~${Math.round(expectedSteps)})`, timestamp: Date.now() };
  }
  if (ratio < 0.4) {
    return { level: "suspect", reason: `Peu de pas détectés: ${steps} pour ${distanceKm.toFixed(2)}km`, timestamp: Date.now() };
  }

  return null;
}

// ─── Analyse combinée (le vrai niveau 🔥) ───
export interface SessionIntegrity {
  status: CheatLevel;
  alerts: CheatAlert[];
  confidence: number; // 0-100
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

  // 1. Analyse vitesse moyenne
  const speedAlert = analyzeSpeed(avgSpeed);
  if (speedAlert) alerts.push(speedAlert);

  // 2. Analyse GPS point par point
  for (let i = 1; i < gpsPoints.length; i++) {
    const jumpAlert = analyzeGpsJump(gpsPoints[i - 1], gpsPoints[i]);
    if (jumpAlert) alerts.push(jumpAlert);
  }

  // 3. Trajectoire
  const trajAlert = analyzeTrajectory(gpsPoints);
  if (trajAlert) alerts.push(trajAlert);

  // 4. Pas vs distance
  const stepAlert = analyzeStepsVsDistance(steps, totalDistanceKm);
  if (stepAlert) alerts.push(stepAlert);

  // 5. Variance de vitesse (coureur = irrégulier, voiture = stable)
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
    // Trop stable = suspect (voiture)
    if (speedVariance < 0.5 && avgSpeed > 10 && gpsPoints.length > 20) {
      alerts.push({ level: "suspect", reason: "Vitesse trop régulière (comportement véhicule)", timestamp: Date.now() });
    }
  }

  // Déterminer statut global
  const hasFraud = alerts.some((a) => a.level === "fraud");
  const hasSuspect = alerts.some((a) => a.level === "suspect");

  const status: CheatLevel = hasFraud ? "fraud" : hasSuspect ? "suspect" : "clean";
  const confidence = hasFraud ? 10 : hasSuspect ? 50 : 95;

  return {
    status,
    alerts,
    confidence,
    speedVariance,
    isBlocked: hasFraud,
  };
}
