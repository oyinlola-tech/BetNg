export interface FeatureFlags {
  readonly virtualFootballEnabled: boolean;
  readonly walletEnabled: boolean;
  readonly shopEnabled: boolean;
  readonly adminEnabled: boolean;
  readonly liveEnabled: boolean;
  readonly tvEnabled: boolean;
  readonly searchEnabled: boolean;
  readonly paymentsEnabled: boolean;
  readonly kycEnabled: boolean;
  readonly responsibleGamingEnabled: boolean;
  readonly twoFactorEnabled: boolean;
  readonly accountSessionsEnabled: boolean;
  readonly statementsEnabled: boolean;
  readonly notificationChannelsEnabled: boolean;
  readonly accountDeletionEnabled: boolean;
  readonly cashShiftsEnabled: boolean;
  readonly complianceEnabled: boolean;
}

export type FeatureFlag = keyof FeatureFlags;

export interface CurrencyConfig {
  readonly code: string;
  readonly symbol: string;
  readonly minorUnits: number;
  readonly locale: string;
}

export interface StakeLimits {
  readonly min: number;
  readonly max: number;
  readonly maxSelections: number;
}

export interface WebPushConfig {
  /** VAPID application server key, base64url. */
  readonly vapidPublicKey: string;
}

export interface PlatformConfigView {
  readonly currency: CurrencyConfig;
  readonly features: Partial<FeatureFlags>;
  readonly stakeLimits?: StakeLimits;
  readonly competitionTimezone?: string;
  readonly maintenance?: boolean;
  /** Present only when the platform delivers browser push. */
  readonly webPush?: WebPushConfig;
}
