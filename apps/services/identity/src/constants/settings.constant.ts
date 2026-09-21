import type { PlatformSettings } from "@betng/contracts";

/** The settings document written once, the first time the service starts on an empty table. */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = Object.freeze({
  minStake: 5_000,
  maxStake: 50_000_000,
  maxPayout: 2_000_000_000,
  maxSelections: 20,
  bettingCloseSeconds: 10,
  ticketExpiryDays: 30,
  exposureLimit: 1_500_000_000,
  maintenanceMode: false,
});

export const SETTINGS_ROW_ID = 1;
