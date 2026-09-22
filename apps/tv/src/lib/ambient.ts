import type { DimSchedule } from "./displaySettings";

export function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);

  return (h ?? 0) * 60 + (m ?? 0);
}

/* 1 is full brightness. A schedule whose end is before its start runs overnight. */
export function brightnessAt(date: Date, schedule: DimSchedule): number {
  if (!schedule.enabled) return 1;

  const now = date.getHours() * 60 + date.getMinutes();
  const start = minutesOf(schedule.start);
  const end = minutesOf(schedule.end);

  if (start === end) return 1;

  const inside = start < end ? now >= start && now < end : now >= start || now < end;

  return inside ? schedule.brightness : 1;
}

export const HOUR_OPTIONS: readonly string[] = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
