import type { FeatureFlag, FeatureFlags } from "./types/index.js";

export const DEFAULT_FLAGS: FeatureFlags = Object.freeze({
  virtualFootballEnabled: true,
  walletEnabled: true,
  shopEnabled: true,
  adminEnabled: true,
  liveEnabled: true,
  tvEnabled: true,
  searchEnabled: true,
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
