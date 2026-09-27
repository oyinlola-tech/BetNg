import type { LimitHistoryEntry, LimitKind, LimitStatus, ResponsibleGamingLimit, SelfExclusionPeriod } from "@betng/contracts";
import { formatCountdown, formatMoney } from "@betng/ui-core";
import type { StatusTone } from "@betng/ui-web";

export const DEPOSIT_KINDS: readonly LimitKind[] = ["deposit_daily", "deposit_weekly", "deposit_monthly"];
export const LOSS_KINDS: readonly LimitKind[] = ["loss_daily", "loss_weekly"];
export const SESSION_KINDS: readonly LimitKind[] = ["session_minutes"];

export const LIMIT_LABEL: Readonly<Record<LimitKind, string>> = {
  deposit_daily: "Daily deposit limit",
  deposit_weekly: "Weekly deposit limit",
  deposit_monthly: "Monthly deposit limit",
  loss_daily: "Daily loss limit",
  loss_weekly: "Weekly loss limit",
  session_minutes: "Session time limit",
};

export const LIMIT_STATUS: Readonly<Record<LimitStatus, { readonly label: string; readonly tone: StatusTone }>> = {
  requested: { label: "Requested", tone: "info" },
  active: { label: "Active", tone: "success" },
  pending: { label: "Pending", tone: "pending" },
  expired: { label: "Expired", tone: "neutral" },
};

export function isMoneyLimit(kind: LimitKind): boolean {
  return kind !== "session_minutes";
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
}

/** `3d 4h` beyond a day, `23h 14m` or `14:05` within one. */
export function formatTimeLeft(milliseconds: number): string {
  const days = Math.floor(milliseconds / 86_400_000);

  if (days < 1) return formatCountdown(milliseconds);

  const hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);

  return hours === 0 ? `${String(days)}d` : `${String(days)}d ${String(hours)}h`;
}

/** The pending change that lands soonest, whether a new value or a removal. */
export function nextPendingLimit(limits: readonly ResponsibleGamingLimit[]): (ResponsibleGamingLimit & { readonly pendingEffectiveAt: string }) | undefined {
  let next: (ResponsibleGamingLimit & { readonly pendingEffectiveAt: string }) | undefined;

  for (const limit of limits) {
    const at = limit.pendingEffectiveAt;

    if (at !== undefined && (next === undefined || Date.parse(at) < Date.parse(next.pendingEffectiveAt))) next = { ...limit, pendingEffectiveAt: at };
  }

  return next;
}

export function formatLimitValue(kind: LimitKind, value: number): string {
  return isMoneyLimit(kind) ? formatMoney(value) : formatMinutes(value);
}

export const EXCLUSION_PERIODS: readonly { readonly value: SelfExclusionPeriod; readonly label: string; readonly description: string }[] = [
  { value: "24h", label: "24 hours", description: "A short break until this time tomorrow." },
  { value: "7d", label: "7 days", description: "A week away from betting and deposits." },
  { value: "30d", label: "30 days", description: "A month away from betting and deposits." },
  { value: "6m", label: "6 months", description: "Six months away. It cannot be cancelled early." },
  { value: "permanent", label: "Permanent", description: "Closes betting and deposits on this account for good." },
];

export const EXCLUSION_LABEL: Readonly<Record<SelfExclusionPeriod, string>> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", "6m": "6 months", permanent: "Permanent" };

export const HISTORY_ACTION: Readonly<Record<LimitHistoryEntry["action"], string>> = {
  SET: "Set",
  RAISED: "Increase requested",
  LOWERED: "Lowered",
  REMOVED: "Removal requested",
  EXPIRED: "Expired",
  EXCLUDED: "Self-exclusion started",
};
