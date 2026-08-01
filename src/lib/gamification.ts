export interface Level {
  name: string;
  minKm: number;
  maxKm: number;
  tier: number;
  /** Raw HSL triplet (no hsl() wrapper) — used for CSS variable theming */
  hsl: string;
  color: string;
}

const mk = (name: string, minKm: number, maxKm: number, tier: number, hsl: string): Level => ({
  name, minKm, maxKm, tier, hsl, color: `hsl(${hsl})`,
});

export const LEVELS: Level[] = [
  mk("ROOKIE I", 0, 20, 1, "152 76% 45%"),
  mk("ROOKIE II", 21, 40, 2, "172 75% 46%"),
  mk("ROOKIE III", 41, 60, 3, "189 94% 50%"),
  mk("GUERRIER DES PAVÉS I", 61, 80, 4, "217 85% 52%"),
  mk("GUERRIER DES PAVÉS II", 81, 100, 5, "224 90% 60%"),
  mk("GUERRIER DES PAVÉS III", 101, 120, 6, "245 75% 58%"),
  mk("MACHINE DE GUERRE I", 121, 140, 7, "265 75% 58%"),
  mk("MACHINE DE GUERRE II", 141, 160, 8, "275 85% 62%"),
  mk("MACHINE DE GUERRE III", 161, 180, 9, "300 85% 58%"),
  mk("FREAK I", 181, 200, 10, "32 96% 54%"),
  mk("FREAK II", 201, 220, 11, "12 90% 58%"),
  mk("FREAK III", 221, 250, 12, "350 85% 48%"),
  mk("FREAK MASTER", 251, Infinity, 13, "45 92% 52%"),
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
