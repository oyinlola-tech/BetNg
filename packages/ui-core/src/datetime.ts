export interface DateTimeConfig {
  readonly locale?: string;
  readonly competitionTimeZone?: string;
}

let config: DateTimeConfig = {};

export function configureDateTime(next: DateTimeConfig): void {
  config = { ...next };
}

function format(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  zone: "local" | "competition" = "local",
): string {
  const timeZone = zone === "competition" ? config.competitionTimeZone : undefined;

  return new Intl.DateTimeFormat(config.locale, {
    ...options,
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(iso));
}

export function formatKickoffTime(iso: string, zone?: "local" | "competition"): string {
  return format(iso, { hour: "2-digit", minute: "2-digit" }, zone);
}

export function formatShortDate(iso: string, zone?: "local" | "competition"): string {
  return format(iso, { weekday: "short", day: "numeric", month: "short" }, zone);
}

export function formatDateTime(iso: string, zone?: "local" | "competition"): string {
  return format(
    iso,
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
    zone,
  );
}

export function formatTimeZoneName(zone: "local" | "competition" = "local"): string {
  const timeZone = zone === "competition" ? config.competitionTimeZone : undefined;
  const parts = new Intl.DateTimeFormat(config.locale, {
    timeZoneName: "short",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).formatToParts(new Date());

  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}

/** `YYYY-MM-DD` in the viewer's zone. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${String(y)}-${m}-${d}`;
}

/** The instants bounding a local calendar day, for a `from`/`to` query. */
export function localDayRange(dateKey: string): { readonly from: string; readonly to: string } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const end = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1);

  return { from: start.toISOString(), to: end.toISOString() };
}

export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${String(minutes)} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${String(hours)} h ago`;

  return formatShortDate(iso);
}

export function formatAge(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${String(seconds)}s ago`;

  return formatRelative(iso, now).toLowerCase();
}
