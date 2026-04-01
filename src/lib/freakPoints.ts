// Freak Points (FP) calculation system
// 10 km = 5 FP
// 1000 steps = 2 FP

export interface CompletedActivity {
  id: string;
  date: string;
  distanceKm: number;
  steps: number;
  durationMin: number;
  avgSpeed: number;
  calories: number;
  fpFromKm: number;
  fpFromSteps: number;
  totalFp: number;
  status: "clean" | "suspect" | "fraud";
}

export function calculateFP(distanceKm: number, steps: number): { fpFromKm: number; fpFromSteps: number; totalFp: number } {
  const fpFromKm = (distanceKm / 10) * 5;
  const fpFromSteps = (steps / 1000) * 2;
  const totalFp = Math.round((fpFromKm + fpFromSteps) * 100) / 100;
  return { fpFromKm: Math.round(fpFromKm * 100) / 100, fpFromSteps: Math.round(fpFromSteps * 100) / 100, totalFp };
}

const STORAGE_KEY = "freakout-activities";

export function saveActivity(activity: CompletedActivity): void {
  const activities = getActivities();
  activities.unshift(activity);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

export function getActivities(): CompletedActivity[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getTotalFP(): number {
  return getActivities()
    .filter(a => a.status !== "fraud")
    .reduce((sum, a) => sum + a.totalFp, 0);
}

export function getTotalStats() {
  const activities = getActivities().filter(a => a.status !== "fraud");
  return {
    totalFp: activities.reduce((s, a) => s + a.totalFp, 0),
    totalKm: activities.reduce((s, a) => s + a.distanceKm, 0),
    totalSteps: activities.reduce((s, a) => s + a.steps, 0),
    totalCalories: activities.reduce((s, a) => s + a.calories, 0),
    totalActivities: activities.length,
  };
}
