import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function formatMissionClock(secondsElapsed: number) {
  const d = Math.floor(secondsElapsed / 86400);
  const h = Math.floor((secondsElapsed % 86400) / 3600);
  const m = Math.floor((secondsElapsed % 3600) / 60);
  const s = Math.floor(secondsElapsed % 60);
  return `MET +${d.toString().padStart(3, "0")}:${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function getCircadianDebtColor(debtH: number): string {
  if (debtH < 1) return "#10b981";
  if (debtH < 2) return "#f59e0b";
  return "#ef4444";
}

export function getMoodWeather(arousal: number, valence: number): string {
  if (valence > 0.5 && arousal > 0.3) return "High arousal · positive valence";
  if (valence > 0.3 && arousal <= 0.3) return "Calm · positive";
  if (valence > -0.1 && Math.abs(arousal) <= 0.3) return "Neutral — within baseline";
  if (valence < -0.3 && arousal < -0.3) return "Low arousal · negative valence";
  if (valence < -0.3 && arousal > 0.3) return "Elevated arousal · negative valence";
  return "Mixed affective signal";
}

export function getMoodLabel(arousal: number, valence: number): string {
  if (valence > 0.5 && arousal > 0.3) return "Engaged";
  if (valence > 0.3 && arousal <= 0.3) return "Composed";
  if (valence > -0.1 && Math.abs(arousal) <= 0.3) return "Balanced";
  if (valence < -0.3 && arousal < -0.3) return "Fatigued";
  if (valence < -0.3 && arousal > 0.3) return "Stressed";
  return "Variable";
}
