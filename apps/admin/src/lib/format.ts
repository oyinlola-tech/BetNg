import type { HealthStatus } from "@betng/contracts";
import { formatBroadcastClock, matchClock } from "@betng/ui-core";
import type { StatusTone } from "@betng/ui-web";

export interface StatusView {
  readonly tone: StatusTone;
  readonly label: string;
}

const view = (tone: StatusTone, label: string): StatusView => ({ tone, label });

export const HEALTH: Readonly<Record<HealthStatus, StatusView>> = {
  ok: view("success", "Healthy"),
  degraded: view("warning", "Degraded"),
  unavailable: view("danger", "Offline"),
};

const STATUS: Readonly<Record<string, StatusView>> = {
  ACTIVE: view("success", "Active"),
  INACTIVE: view("neutral", "Inactive"),
  SUSPENDED: view("danger", "Suspended"),
  OFFLINE: view("neutral", "Offline"),
  SCHEDULED: view("neutral", "Scheduled"),
  BETTING_OPEN: view("brand", "Betting open"),
  BETTING_CLOSED: view("warning", "Betting closed"),
  IN_PLAY: view("live", "Live"),
  COMPLETED: view("success", "Completed"),
  CANCELLED: view("danger", "Void"),
  NOT_OPEN: view("neutral", "Not open"),
  OPEN: view("success", "Open"),
  CLOSED: view("neutral", "Closed"),
  SETTLED: view("neutral", "Settled"),
  QUEUED: view("neutral", "Queued"),
  READY: view("brand", "Ready"),
  RUNNING: view("live", "Running"),
  FAILED: view("danger", "Failed"),
  NOT_DUE: view("neutral", "Not due"),
  PENDING: view("warning", "Pending"),
  VOIDED: view("neutral", "Voided"),
  NORMAL: view("success", "Normal"),
  ELEVATED: view("warning", "Elevated"),
  CRITICAL: view("danger", "Critical"),
};

export function statusView(status: string): StatusView {
  return STATUS[status] ?? view("neutral", status);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function daysAgoKey(days: number, now = Date.now()): string {
  const d = new Date(now - days * 86_400_000);

  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortDay(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly (string | number)[])[]): void {
  const escape = (cell: string | number): string => (typeof cell === "number" ? String(cell) : `"${cell.replace(/"/g, '""')}"`);
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const shortMoney = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 });

/** `₦4.2M` for KPI tiles and chart ticks, where the full figure is available on hover or in the table. */
export function formatMoneyShort(minorUnits: number): string {
  return `${minorUnits < 0 ? "-" : ""}₦${shortMoney.format(Math.abs(minorUnits) / 100)}`;
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function liveClock(kickoffAt: string, now: number): string {
  const clock = matchClock(kickoffAt, now);

  if (clock.period === "HALF_TIME") return "HT";
  if (clock.period === "FULL_TIME") return "FT";
  if (clock.period === "PRE") return "--:--";

  return formatBroadcastClock(clock.minute, clock.second);
}
