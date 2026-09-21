export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

export function formatMinute(minute: number): string {
  return `${String(minute)}'`;
}

/** `67:24`, for a broadcast clock. */
export function formatBroadcastClock(minute: number, second: number): string {
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);

    return `${String(hours)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatMatchday(matchday: number): string {
  return `Matchday ${String(matchday).padStart(2, "0")}`;
}

export function formatScore(home: number, away: number): string {
  return `${String(home)} – ${String(away)}`;
}
