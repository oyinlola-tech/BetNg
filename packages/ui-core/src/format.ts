/** Formatters shared by every client. */

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactNairaFormatter = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `₦12,500.00` from 1_250_000 kobo. */
export function formatMoney(minorUnits: number): string {
  const sign = minorUnits < 0 ? "-" : "";

  return `${sign}₦${nairaFormatter.format(Math.abs(minorUnits) / 100)}`;
}

/** `₦12,500` — for a quick-stake chip. */
export function formatMoneyCompact(minorUnits: number): string {
  return `₦${compactNairaFormatter.format(Math.round(minorUnits / 100))}`;
}

/** `+₦4,200.00` / `-₦1,000.00` for a ledger. */
export function formatSignedMoney(minorUnits: number): string {
  return `${minorUnits >= 0 ? "+" : "-"}${formatMoney(Math.abs(minorUnits))}`;
}

/** `2.10` — decimal odds always show two places. */
export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

/** `67'` or `45+'`-free: the platform has no stoppage time. */
export function formatMinute(minute: number): string {
  return `${String(minute)}'`;
}

/** `67:24`, for a broadcast clock. */
export function formatBroadcastClock(minute: number, second: number): string {
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

/** `02:14` for a countdown; `0:07` under a minute reads worse, so always mm:ss. */
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

/** `14:32` local time. */
export function formatKickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `Sat 20 Sep`. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** `20 Sep 2026, 14:32`. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `YYYY-MM-DD` in local time, for grouping results by day. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${String(y)}-${m}-${d}`;
}

/** `Matchday 04`. */
export function formatMatchday(matchday: number): string {
  return `Matchday ${String(matchday).padStart(2, "0")}`;
}

/** `Just now`, `3 min ago`, `2 h ago`, else a short date. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${String(hours)} h ago`;

  return formatShortDate(iso);
}

/** `2 – 1` with an en dash, the typographic way to set a score. */
export function formatScore(home: number, away: number): string {
  return `${String(home)} – ${String(away)}`;
}
