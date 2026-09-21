import type { FeatureFlag, FeatureFlags } from "./types/index.js";

export const DEFAULT_FLAGS: FeatureFlags = Object.freeze({
  virtualFootballEnabled: true,
  walletEnabled: true,
  shopEnabled: true,
  adminEnabled: true,
  liveEnabled: true,
  tvEnabled: true,
  searchEnabled: true,
  paymentsEnabled: false,
  kycEnabled: false,
  responsibleGamingEnabled: false,
  twoFactorEnabled: false,
  accountSessionsEnabled: false,
  statementsEnabled: false,
  notificationChannelsEnabled: false,
  accountDeletionEnabled: false,
  cashShiftsEnabled: false,
  complianceEnabled: false,
});

/** `VITE_FEATURE_PAYMENTS=true` style variables, one per flag, next to the combined `VITE_FEATURE_FLAGS` list. */
export const FLAG_VARIABLES: Readonly<Partial<Record<FeatureFlag, string>>> = Object.freeze({
  paymentsEnabled: "VITE_FEATURE_PAYMENTS",
  kycEnabled: "VITE_FEATURE_KYC",
  responsibleGamingEnabled: "VITE_FEATURE_RESPONSIBLE_GAMING",
  twoFactorEnabled: "VITE_FEATURE_TWO_FACTOR",
  accountSessionsEnabled: "VITE_FEATURE_ACCOUNT_SESSIONS",
  statementsEnabled: "VITE_FEATURE_STATEMENTS",
  notificationChannelsEnabled: "VITE_FEATURE_NOTIFICATIONS",
  accountDeletionEnabled: "VITE_FEATURE_ACCOUNT_DELETION",
  cashShiftsEnabled: "VITE_FEATURE_CASH_SHIFTS",
  complianceEnabled: "VITE_FEATURE_COMPLIANCE",
});

const FLAG_NAMES = Object.keys(DEFAULT_FLAGS) as readonly FeatureFlag[];

/** Build-time overrides as `flag=false,other=true`, from an environment variable. */
export function parseFlagOverrides(text: string | undefined): Partial<FeatureFlags> {
  const overrides: Partial<Record<FeatureFlag, boolean>> = {};

  for (const entry of (text ?? "").split(",")) {
    const [name, value] = entry.split("=").map((part) => part.trim());

    if (name === undefined || !FLAG_NAMES.includes(name as FeatureFlag)) continue;
    if (value === "true" || value === "false") overrides[name as FeatureFlag] = value === "true";
  }

  return overrides;
}

export function resolveFlags(
  platform: Partial<FeatureFlags> | undefined,
  overrides: Partial<FeatureFlags> = {},
): FeatureFlags {
  return Object.freeze({ ...DEFAULT_FLAGS, ...overrides, ...(platform ?? {}) });
}
