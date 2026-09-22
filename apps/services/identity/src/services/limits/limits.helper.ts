import type { LimitKind, LimitsSummary, ResponsibleGamingLimit } from "@betng/contracts";
import { RESPONSIBLE_GAMING } from "../../constants/index.js";
import { toLimit, toSelfExclusion } from "../../dtos/index.js";
import { InvalidInputError } from "../../errors/index.js";
import type { Customer, ResponsibleGamingLimit as LimitRow } from "../../generated/prisma/client.js";
import type { HandlerDependencies, IdentityStore } from "../../interfaces/index.js";

const DAY_MS = 86_400_000;

export const WINDOW_MS: Readonly<Record<Exclude<LimitKind, "session_minutes">, number>> = {
  deposit_daily: DAY_MS,
  deposit_weekly: 7 * DAY_MS,
  deposit_monthly: 30 * DAY_MS,
  loss_daily: DAY_MS,
  loss_weekly: 7 * DAY_MS,
};

export const DEPOSIT_KINDS = ["deposit_daily", "deposit_weekly", "deposit_monthly"] as const;
export const LOSS_KINDS = ["loss_daily", "loss_weekly"] as const;

const LIMIT_LABEL: Readonly<Record<LimitKind, string>> = {
  deposit_daily: "daily deposit limit",
  deposit_weekly: "weekly deposit limit",
  deposit_monthly: "monthly deposit limit",
  loss_daily: "daily loss limit",
  loss_weekly: "weekly loss limit",
  session_minutes: "session time limit",
};

export const limitLabel = (kind: LimitKind): string => LIMIT_LABEL[kind];

export const PERIOD_MS: Readonly<Record<string, number | undefined>> = {
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
  "6m": 182 * DAY_MS,
  permanent: undefined,
};

export function assertLimitValue(kind: LimitKind, value: number): void {
  if (kind === "session_minutes") {
    if (value < RESPONSIBLE_GAMING.MIN_SESSION_MINUTES || value > RESPONSIBLE_GAMING.MAX_SESSION_MINUTES) {
      throw new InvalidInputError("value", "Choose between 15 minutes and 24 hours.");
    }

    return;
  }

  if (value < RESPONSIBLE_GAMING.MIN_MONEY_LIMIT || value > RESPONSIBLE_GAMING.MAX_MONEY_LIMIT) {
    throw new InvalidInputError("value", "Set a limit between ₦1 and ₦1,000,000,000.");
  }
}

type SummaryDependencies = Pick<HandlerDependencies, "readModel">;

async function usageOf(
  deps: SummaryDependencies,
  store: IdentityStore,
  customerId: string,
  row: LimitRow,
  now: Date,
): Promise<{ readonly used: number; readonly resetsAt: Date | undefined } | undefined> {
  const kind = row.kind as LimitKind;

  if (kind === "session_minutes") {
    const session = await store.sessions.newestLive(customerId, now);

    return session === undefined ? undefined : { used: Math.floor((now.getTime() - session.createdAt.getTime()) / 60_000), resetsAt: undefined };
  }

  const window = WINDOW_MS[kind];
  const since = new Date(now.getTime() - window);
  const usage = kind.startsWith("deposit") ? await deps.readModel.depositUsage(customerId, since) : await deps.readModel.lossUsage(customerId, since);

  return {
    used: Number(usage.used),
    resetsAt: usage.used > 0n && usage.oldestAt !== undefined ? new Date(usage.oldestAt.getTime() + window) : undefined,
  };
}

/** Why the account may not deposit or bet right now, if it may not. */
export async function restriction(
  store: IdentityStore,
  customer: Customer,
  now: Date,
): Promise<{ readonly code: "SELF_EXCLUDED" | "ACCOUNT_RESTRICTED"; readonly message: string } | undefined> {
  if (customer.status !== "ACTIVE" || customer.deletedAt !== null) {
    return { code: "ACCOUNT_RESTRICTED", message: "This account is restricted." };
  }

  if ((await store.limits.activeExclusion(customer.id, now)) !== undefined) {
    return { code: "SELF_EXCLUDED", message: "Betting and deposits are paused while your self-exclusion is active." };
  }

  if ((await store.deletions.findLatest(customer.id))?.status === "PENDING") {
    return { code: "ACCOUNT_RESTRICTED", message: "This account is scheduled for deletion. Cancel the deletion to continue." };
  }

  return undefined;
}

/** Due loosenings and removals are applied first, so every answer reflects the cooling-off state as of now. */
export async function buildLimitsSummary(deps: SummaryDependencies, store: IdentityStore, customer: Customer, now = new Date()): Promise<LimitsSummary> {
  await store.limits.settleDue(customer.id, now);

  const [rows, exclusion, restricted] = await Promise.all([
    store.limits.list(customer.id),
    store.limits.activeExclusion(customer.id, now),
    restriction(store, customer, now),
  ]);

  const limits: ResponsibleGamingLimit[] = await Promise.all(
    rows.map(async (row) => toLimit(row, await usageOf(deps, store, customer.id, row, now))),
  );

  return { limits, selfExclusion: toSelfExclusion(exclusion), restricted: restricted !== undefined };
}
