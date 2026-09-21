import type { HealthStatus } from "@betng/contracts";
import { currentCurrency, formatDateTime } from "@betng/ui-core";
import type { StatusTone } from "@betng/ui-web";

export interface StatusView {
  readonly tone: StatusTone;
  readonly label: string;
}

const view = (tone: StatusTone, label: string): StatusView => ({ tone, label });

export const HEALTH: Readonly<Record<HealthStatus, StatusView & { readonly status: string }>> = {
  ok: { ...view("success", "Healthy"), status: "HEALTHY" },
  degraded: { ...view("warning", "Degraded"), status: "DEGRADED" },
  unavailable: { ...view("danger", "Unavailable"), status: "ERROR" },
};

/* Wording for platform states where the raw value would read badly. Tone and icon come from ui-web's status presets. */
export const STATUS_LABELS: Readonly<Record<string, string>> = {
  IN_PLAY: "Live",
  CANCELLED: "Void",
  NOT_OPEN: "Not open",
  NOT_DUE: "Not due",
  BETTING_OPEN: "Betting open",
  BETTING_CLOSED: "Betting closed",
  ACCEPT: "Accept",
  LIMIT: "Limit",
  REJECT: "Reject",
};

export const DASH = "—";

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-NG");
}

export function dayKey(offsetDays: number, now = Date.now()): string {
  const d = new Date(now - offsetDays * 86_400_000);

  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortDay(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function formatStamp(iso: string | undefined): string {
  return iso === undefined ? DASH : formatDateTime(iso);
}

export function humanise(value: string): string {
  const words = value.replace(/[_.-]+/g, " ").toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

const compact = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 });

/** Chart axes and tooltips only, where a full amount does not fit. Tables and cards show full amounts. */
export function formatMoneyAxis(minorUnits: number): string {
  const currency = currentCurrency();

  return `${minorUnits < 0 ? "-" : ""}${currency.symbol}${compact.format(Math.abs(minorUnits) / 10 ** currency.minorUnits)}`;
}
