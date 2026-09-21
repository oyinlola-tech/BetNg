import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import { percentToBasisPoints } from "../utils/index.js";

export const SERVICE_NAME = "settlement" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3004;

const RETRY_INTERVAL_MS = 5000;

export interface SettlementOptions {
  readonly retryEnabled: boolean;
  readonly retryIntervalMs: number;
  /** Seeded once; afterwards the database is authoritative. */
  readonly defaultShopShareBasisPoints: number;
}

export interface SettlementConfig extends ServiceConfig {
  readonly settlement: SettlementOptions;
}

type Env = Readonly<Record<string, string | undefined>>;

function readBoolean(env: Env, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();

  if (raw === undefined || raw === "") {
    return fallback;
  }

  if (raw === "true" || raw === "1") {
    return true;
  }

  if (raw === "false" || raw === "0") {
    return false;
  }

  throw new Error(`${key} must be "true" or "false".`);
}

function readSharePercent(env: Env): number {
  const raw = env["DEFAULT_SHOP_SHARE_PERCENT"]?.trim();

  try {
    return percentToBasisPoints(raw === undefined || raw === "" ? "20" : raw);
  } catch {
    throw new Error("DEFAULT_SHOP_SHARE_PERCENT must be a percent between 0 and 100 with at most two decimals.");
  }
}

export async function loadSettlementConfig(env?: Env): Promise<SettlementConfig> {
  const base = await loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "SETTLEMENT_DATABASE_URL",
    ...(env === undefined ? {} : { env }),
  });

  const source = env ?? process.env;

  return Object.freeze({
    ...base,
    settlement: Object.freeze({
      retryEnabled: readBoolean(source, "SETTLEMENT_RETRY_ENABLED", true),
      retryIntervalMs: RETRY_INTERVAL_MS,
      defaultShopShareBasisPoints: readSharePercent(source),
    }),
  });
}
