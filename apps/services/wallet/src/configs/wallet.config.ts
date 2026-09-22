import process from "node:process";
import { loadPaymentSettings, usesRealProvider } from "./payments.config.js";
import type { PaymentSettings } from "./payments.config.js";

export interface WalletSettings {
  readonly welcomeGrantKobo: bigint;
  readonly shopOpeningFloatKobo: bigint;
  readonly depositMaxKobo: number;
  readonly withdrawalMaxKobo: number;
  readonly payments: PaymentSettings;
}

const DEFAULTS = Object.freeze({
  WELCOME_GRANT_KOBO: 10_000_000,
  SHOP_OPENING_FLOAT_KOBO: 50_000_000,
  SIMULATED_DEPOSIT_MAX_KOBO: 100_000_000,
  SIMULATED_WITHDRAWAL_MAX_KOBO: 100_000_000,
});

type SettingKey = keyof typeof DEFAULTS;

/** An invalid money setting stops the service; it is never guessed at. */
function readKobo(
  env: Readonly<Record<string, string | undefined>>,
  key: SettingKey,
  minimum: number,
): number {
  const raw = env[key];

  if (raw === undefined || raw.trim() === "") {
    return DEFAULTS[key];
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(
      `${key} must be an integer number of kobo, at least ${String(minimum)}.`,
    );
  }

  return value;
}

export function loadWalletSettings(
  env: Readonly<Record<string, string | undefined>> = process.env,
): WalletSettings {
  const payments = loadPaymentSettings(env);
  const realMoney = usesRealProvider(payments) || payments.environment === "production";
  const welcomeGrant = realMoney && (env["WELCOME_GRANT_KOBO"] ?? "").trim() === "" ? 0 : readKobo(env, "WELCOME_GRANT_KOBO", 0);

  if (realMoney && welcomeGrant > 0) {
    throw new Error("WELCOME_GRANT_KOBO must be 0 when wallets hold real money.");
  }

  return Object.freeze({
    welcomeGrantKobo: BigInt(welcomeGrant),
    shopOpeningFloatKobo: BigInt(readKobo(env, "SHOP_OPENING_FLOAT_KOBO", 0)),
    depositMaxKobo: readKobo(env, "SIMULATED_DEPOSIT_MAX_KOBO", 1),
    withdrawalMaxKobo: readKobo(env, "SIMULATED_WITHDRAWAL_MAX_KOBO", 1),
    payments,
  });
}
