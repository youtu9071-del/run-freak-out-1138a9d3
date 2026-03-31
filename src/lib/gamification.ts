export interface Level {
  name: string;
  minKm: number;
  maxKm: number;
  tier: number;
  color: string;
}

export const LEVELS: Level[] = [
  { name: "ROOKIE I", minKm: 0, maxKm: 20, tier: 1, color: "hsl(220 10% 50%)" },
  { name: "ROOKIE II", minKm: 21, maxKm: 40, tier: 2, color: "hsl(220 10% 60%)" },
  { name: "ROOKIE III", minKm: 41, maxKm: 60, tier: 3, color: "hsl(220 10% 70%)" },
  { name: "GUERRIER DES PAVÉS I", minKm: 61, maxKm: 80, tier: 4, color: "hsl(30 80% 50%)" },
  { name: "GUERRIER DES PAVÉS II", minKm: 81, maxKm: 100, tier: 5, color: "hsl(30 90% 55%)" },
  { name: "GUERRIER DES PAVÉS III", minKm: 101, maxKm: 120, tier: 6, color: "hsl(25 100% 55%)" },
  { name: "MACHINE DE GUERRE I", minKm: 121, maxKm: 140, tier: 7, color: "hsl(0 70% 50%)" },
  { name: "MACHINE DE GUERRE II", minKm: 141, maxKm: 160, tier: 8, color: "hsl(0 80% 55%)" },
  { name: "MACHINE DE GUERRE III", minKm: 161, maxKm: 180, tier: 9, color: "hsl(350 90% 55%)" },
  { name: "FREAK I", minKm: 181, maxKm: 200, tier: 10, color: "hsl(145 80% 50%)" },
  { name: "FREAK II", minKm: 201, maxKm: 220, tier: 11, color: "hsl(145 80% 55%)" },
  { name: "FREAK III", minKm: 221, maxKm: 250, tier: 12, color: "hsl(145 90% 60%)" },
  { name: "FREAK MASTER", minKm: 251, maxKm: Infinity, tier: 13, color: "hsl(50 100% 50%)" },
];

export function getLevel(totalKm: number): Level {
  return LEVELS.find(l => totalKm >= l.minKm && totalKm <= l.maxKm) || LEVELS[0];
}

export function getLevelProgress(totalKm: number): number {
  const level = getLevel(totalKm);
  if (level.maxKm === Infinity) return 100;
  const range = level.maxKm - level.minKm;
  return Math.min(100, ((totalKm - level.minKm) / range) * 100);
}

export function calculatePoints(distanceKm: number, avgSpeed: number, streak: number): number {
  const base = distanceKm * 10;
  const speedBonus = avgSpeed > 10 ? distanceKm * 5 : avgSpeed > 8 ? distanceKm * 3 : 0;
  const streakBonus = streak * 2;
  return Math.round(base + speedBonus + streakBonus);
}

export function calculateCalories(distanceKm: number, weightKg: number = 70): number {
  return Math.round(distanceKm * weightKg * 1.036);
}

export interface UserStats {
  username: string;
  avatarUrl?: string;
  country: string;
  totalKm: number;
  totalPoints: number;
  totalCalories: number;
  totalRuns: number;
  streak: number;
  bestPace: number; // min/km
  longestRun: number;
}

export interface Activity {
  id: string;
  date: string;
  distanceKm: number;
  durationMin: number;
  avgSpeed: number;
  calories: number;
  points: number;
  route?: [number, number][];
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  country: string;
  totalKm: number;
  totalPoints: number;
  level: Level;
}

// Mock data
export const MOCK_USER: UserStats = {
  username: "RunnerX",
  country: "FR",
  totalKm: 87.4,
  totalPoints: 1240,
  totalCalories: 6340,
  totalRuns: 14,
  streak: 5,
  bestPace: 4.8,
  longestRun: 12.3,
};

export const MOCK_ACTIVITIES: Activity[] = [
  { id: "1", date: "2026-03-30", distanceKm: 8.2, durationMin: 42, avgSpeed: 11.7, calories: 595, points: 123 },
  { id: "2", date: "2026-03-28", distanceKm: 5.1, durationMin: 28, avgSpeed: 10.9, calories: 370, points: 76 },
  { id: "3", date: "2026-03-26", distanceKm: 10.5, durationMin: 58, avgSpeed: 10.9, calories: 762, points: 158 },
  { id: "4", date: "2026-03-24", distanceKm: 6.7, durationMin: 38, avgSpeed: 10.6, calories: 486, points: 100 },
  { id: "5", date: "2026-03-22", distanceKm: 3.2, durationMin: 20, avgSpeed: 9.6, calories: 232, points: 32 },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, username: "SpeedDemon", country: "FR", totalKm: 267, totalPoints: 4200, level: getLevel(267) },
  { rank: 2, username: "NightRunner", country: "BE", totalKm: 198, totalPoints: 3100, level: getLevel(198) },
  { rank: 3, username: "FlashMcRun", country: "FR", totalKm: 156, totalPoints: 2450, level: getLevel(156) },
  { rank: 4, username: "RunnerX", country: "FR", totalKm: 87.4, totalPoints: 1240, level: getLevel(87.4) },
  { rank: 5, username: "MarathonKing", country: "SN", totalKm: 82, totalPoints: 1100, level: getLevel(82) },
  { rank: 6, username: "UrbanSprint", country: "FR", totalKm: 74, totalPoints: 980, level: getLevel(74) },
  { rank: 7, username: "PavéWarrior", country: "CI", totalKm: 65, totalPoints: 870, level: getLevel(65) },
  { rank: 8, username: "FitBeast", country: "MA", totalKm: 48, totalPoints: 620, level: getLevel(48) },
  { rank: 9, username: "ZenRunner", country: "FR", totalKm: 35, totalPoints: 430, level: getLevel(35) },
  { rank: 10, username: "NewbieGo", country: "TN", totalKm: 12, totalPoints: 150, level: getLevel(12) },
];
