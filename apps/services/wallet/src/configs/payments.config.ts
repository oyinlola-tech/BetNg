import { Buffer } from "node:buffer";
import type { ProviderId } from "../constants/payments.constant.js";
import { Secret } from "./secret.js";

/** One key of the encryption ring: `version` is the `v<n>` tag its ciphertext carries. */
export interface VersionedKey {
  readonly version: number;
  readonly secret: Secret;
}

export type WalletEnvironment = "development" | "test" | "production";

type Env = Readonly<Record<string, string | undefined>>;

export interface PaystackSettings {
  readonly secretKey: Secret;
  readonly baseUrl: string;
}

export interface FlutterwaveSettings {
  readonly secretKey: Secret;
  readonly webhookHash: Secret;
  readonly baseUrl: string;
}

export interface StorageSettings {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: Secret;
  readonly secretAccessKey: Secret;
  readonly forcePathStyle: boolean;
}

export interface WithdrawalFeeSettings {
  readonly standardKobo: number;
  readonly highKobo: number;
  readonly highFromKobo: number;
}

export interface PaymentSettings {
  readonly environment: WalletEnvironment;
  /** Undefined: payments are switched off and every payment route answers PAYMENT_PROVIDER_UNAVAILABLE. */
  readonly activeProvider: ProviderId | undefined;
  readonly paystack: PaystackSettings | undefined;
  readonly flutterwave: FlutterwaveSettings | undefined;
  readonly callbackBaseUrl: string | undefined;
  readonly defaultReturnPath: string;
  readonly providerTimeoutMs: number;
  readonly depositMinKobo: number;
  readonly depositMaxKobo: number;
  readonly depositTtlMs: number;
  readonly withdrawalMinKobo: number;
  readonly withdrawalMaxKobo: number;
  readonly withdrawalFee: WithdrawalFeeSettings;
  readonly withdrawalReviewThresholdKobo: number;
  readonly encryptionKey: Secret | undefined;
  /** The version new ciphertext is written under; defaults to 1. */
  readonly encryptionKeyVersion: number;
  /** Decrypt-only keys a rotation has retired, so their rows still open. */
  readonly retiredEncryptionKeys: readonly VersionedKey[];
  readonly storage: StorageSettings | undefined;
  readonly jobsEnabled: boolean;
  readonly jobsIntervalMs: number;
  /** The play-money `/wallets/deposit|withdraw` routes; never on in production or beside a real provider. */
  readonly simulatedFundsEnabled: boolean;
}

const PROVIDER_NAMES: Readonly<Record<string, ProviderId | "NONE">> = Object.freeze({
  paystack: "PAYSTACK",
  flutterwave: "FLUTTERWAVE",
  bachs: "BACHS",
  sandbox: "SANDBOX",
  none: "NONE",
});

const REAL_PROVIDERS: readonly ProviderId[] = ["PAYSTACK", "FLUTTERWAVE"];

function fail(message: string): never {
  throw new Error(`Wallet payments configuration: ${message}`);
}

function text(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();

  return value === undefined || value === "" ? undefined : value;
}

function integer(env: Env, key: string, fallback: number, minimum: number): number {
  const raw = text(env, key);

  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < minimum) {
    fail(`${key} must be an integer of at least ${String(minimum)}.`);
  }

  return value;
}

function flag(env: Env, key: string, fallback: boolean): boolean {
  const raw = text(env, key)?.toLowerCase();

  if (raw === undefined) {
    return fallback;
  }

  if (raw === "true" || raw === "1") {
    return true;
  }

  if (raw === "false" || raw === "0") {
    return false;
  }

  return fail(`${key} must be true or false.`);
}

function isLocalHost(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

/** https everywhere; plain http only for a loopback host outside production. */
function baseUrl(env: Env, key: string, fallback: string | undefined, environment: WalletEnvironment): string | undefined {
  const raw = text(env, key) ?? fallback;

  if (raw === undefined) {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return fail(`${key} is not a URL.`);
  }

  const secure = url.protocol === "https:";
  const localDevelopment = environment !== "production" && url.protocol === "http:" && isLocalHost(url);

  if (!secure && !localDevelopment) {
    fail(`${key} must be an https URL.`);
  }

  if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
    fail(`${key} must not carry credentials, a query or a fragment.`);
  }

  return url.origin + url.pathname.replace(/\/+$/u, "");
}

function environmentOf(env: Env): WalletEnvironment {
  const value = text(env, "NODE_ENV");

  return value === "production" || value === "test" ? value : "development";
}

function activeProviderOf(env: Env, environment: WalletEnvironment): ProviderId | undefined {
  const raw = text(env, "PAYMENTS_PROVIDER")?.toLowerCase();

  if (raw === undefined) {
    if (environment === "production") {
      fail("PAYMENTS_PROVIDER must be set in production (paystack, flutterwave or none).");
    }

    return "SANDBOX";
  }

  const provider = PROVIDER_NAMES[raw];

  if (provider === undefined) {
    return fail("PAYMENTS_PROVIDER must be one of paystack, flutterwave, bachs, sandbox or none.");
  }

  return provider === "NONE" ? undefined : provider;
}

function paystackOf(env: Env, environment: WalletEnvironment): PaystackSettings | undefined {
  const key = text(env, "PAYSTACK_SECRET_KEY");

  if (key === undefined) {
    return undefined;
  }

  if (!/^sk_(live|test)_[A-Za-z0-9]{16,}$/u.test(key)) {
    fail("PAYSTACK_SECRET_KEY is not a Paystack secret key.");
  }

  if (environment === "production" && key.startsWith("sk_test_")) {
    fail("PAYSTACK_SECRET_KEY is a test key; production needs a live key.");
  }

  return {
    secretKey: new Secret(key),
    baseUrl: baseUrl(env, "PAYSTACK_BASE_URL", "https://api.paystack.co", environment) ?? fail("PAYSTACK_BASE_URL"),
  };
}

function flutterwaveOf(env: Env, environment: WalletEnvironment): FlutterwaveSettings | undefined {
  const key = text(env, "FLUTTERWAVE_SECRET_KEY");
  const hash = text(env, "FLUTTERWAVE_WEBHOOK_HASH");

  if (key === undefined && hash === undefined) {
    return undefined;
  }

  if (key === undefined || !/^FLWSECK(_TEST)?-[A-Za-z0-9-]{16,}$/u.test(key)) {
    return fail("FLUTTERWAVE_SECRET_KEY is not a Flutterwave secret key.");
  }

  if (hash === undefined || hash.length < 16) {
    return fail("FLUTTERWAVE_WEBHOOK_HASH must be set (at least 16 characters) with FLUTTERWAVE_SECRET_KEY.");
  }

  if (environment === "production" && key.includes("_TEST")) {
    fail("FLUTTERWAVE_SECRET_KEY is a test key; production needs a live key.");
  }

  return {
    secretKey: new Secret(key),
    webhookHash: new Secret(hash),
    baseUrl: baseUrl(env, "FLUTTERWAVE_BASE_URL", "https://api.flutterwave.com", environment) ?? fail("FLUTTERWAVE_BASE_URL"),
  };
}

function checkedKey(raw: string, key: string): Secret {
  if (Buffer.from(raw, "base64").length !== 32 || !/^[A-Za-z0-9+/]{43}=$/u.test(raw)) {
    fail(`${key} must be 32 random bytes, base64 encoded (openssl rand -base64 32).`);
  }

  return new Secret(raw);
}

function encryptionKeyOf(env: Env): Secret | undefined {
  const raw = text(env, "WALLET_ENCRYPTION_KEY");

  return raw === undefined ? undefined : checkedKey(raw, "WALLET_ENCRYPTION_KEY");
}

/**
 * Keys a rotation has retired: decrypt-only, so rows written under them still
 * open while every new write uses the active key. Format: `version:base64key`,
 * comma separated. A key stays listed until the re-encryption pass has moved
 * every row off it; dropping it early makes those rows unreadable.
 */
function retiredKeysOf(env: Env, activeVersion: number): VersionedKey[] {
  const raw = text(env, "WALLET_ENCRYPTION_KEYS_RETIRED");

  if (raw === undefined) {
    return [];
  }

  const keys = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map((entry) => {
      const separator = entry.indexOf(":");
      const version = Number(entry.slice(0, separator));

      if (separator < 1 || !Number.isInteger(version) || version < 1) {
        fail("WALLET_ENCRYPTION_KEYS_RETIRED entries must be version:base64key, with version a positive integer.");
      }

      if (version === activeVersion) {
        fail(`WALLET_ENCRYPTION_KEYS_RETIRED lists version ${String(version)}, which is the active key version.`);
      }

      return { version, secret: checkedKey(entry.slice(separator + 1), "WALLET_ENCRYPTION_KEYS_RETIRED") };
    });

  const versions = new Set(keys.map((key) => key.version));

  if (versions.size !== keys.length) {
    fail("WALLET_ENCRYPTION_KEYS_RETIRED lists the same version twice.");
  }

  return keys;
}

function storageOf(env: Env): StorageSettings | undefined {
  const keys = [
    "WALLET_STORAGE_ENDPOINT",
    "WALLET_STORAGE_REGION",
    "WALLET_STORAGE_BUCKET",
    "WALLET_STORAGE_ACCESS_KEY_ID",
    "WALLET_STORAGE_SECRET_ACCESS_KEY",
  ] as const;
  const values = keys.map((key) => text(env, key));

  if (values.every((value) => value === undefined)) {
    return undefined;
  }

  const [endpoint, region, bucket, accessKeyId, secretAccessKey] = values;

  if (endpoint === undefined || region === undefined || bucket === undefined || accessKeyId === undefined || secretAccessKey === undefined) {
    return fail(`statement storage needs all of ${keys.join(", ")}.`);
  }

  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return fail("WALLET_STORAGE_ENDPOINT is not a URL.");
  }

  if (url.protocol !== "https:" || url.pathname !== "/" || url.search !== "" || url.username !== "") {
    fail("WALLET_STORAGE_ENDPOINT must be a bare https origin: download links are https only.");
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket)) {
    fail("WALLET_STORAGE_BUCKET is not a valid bucket name.");
  }

  if (!/^[a-z0-9-]{2,32}$/u.test(region)) {
    fail("WALLET_STORAGE_REGION is not a valid region.");
  }

  return {
    endpoint: url.origin,
    region,
    bucket,
    accessKeyId: new Secret(accessKeyId),
    secretAccessKey: new Secret(secretAccessKey),
    forcePathStyle: flag(env, "WALLET_STORAGE_FORCE_PATH_STYLE", true),
  };
}

export function loadPaymentSettings(env: Env): PaymentSettings {
  const environment = environmentOf(env);
  const activeProvider = activeProviderOf(env, environment);
  const paystack = paystackOf(env, environment);
  const flutterwave = flutterwaveOf(env, environment);
  const encryptionKey = encryptionKeyOf(env);
  const encryptionKeyVersion = integer(env, "WALLET_ENCRYPTION_KEY_VERSION", 1, 1);
  const retiredEncryptionKeys = retiredKeysOf(env, encryptionKeyVersion);
  const production = environment === "production";
  const realProvider = activeProvider !== undefined && REAL_PROVIDERS.includes(activeProvider);

  if (production && activeProvider === "SANDBOX") {
    fail("the sandbox provider is for development and test only.");
  }

  if (production && activeProvider === "BACHS") {
    fail("Bachs has no configured API in this service; select paystack, flutterwave or none.");
  }

  if (activeProvider === "PAYSTACK" && paystack === undefined) {
    fail("PAYMENTS_PROVIDER=paystack needs PAYSTACK_SECRET_KEY.");
  }

  if (activeProvider === "FLUTTERWAVE" && flutterwave === undefined) {
    fail("PAYMENTS_PROVIDER=flutterwave needs FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_HASH.");
  }

  const callbackBaseUrl = baseUrl(
    env,
    "PAYMENTS_CALLBACK_BASE_URL",
    realProvider ? undefined : "http://localhost:5173",
    environment,
  );

  if (realProvider && callbackBaseUrl === undefined) {
    fail("PAYMENTS_CALLBACK_BASE_URL (the web origin customers return to) is required with a real provider.");
  }

  if ((realProvider || production) && activeProvider !== undefined && encryptionKey === undefined) {
    fail("WALLET_ENCRYPTION_KEY is required: bank account numbers are stored encrypted.");
  }

  const simulatedFundsEnabled = flag(env, "WALLET_SIMULATED_FUNDS", !production && !realProvider);

  if (simulatedFundsEnabled && (production || realProvider)) {
    fail("WALLET_SIMULATED_FUNDS cannot be on in production or beside a real payment provider.");
  }

  const depositMinKobo = integer(env, "PAYMENTS_DEPOSIT_MIN_KOBO", 10_000, 1);
  const depositMaxKobo = integer(env, "PAYMENTS_DEPOSIT_MAX_KOBO", 100_000_000, depositMinKobo);
  const withdrawalMinKobo = integer(env, "WITHDRAWAL_MIN_KOBO", 100_000, 1);
  const withdrawalMaxKobo = integer(env, "WITHDRAWAL_MAX_KOBO", 500_000_000, withdrawalMinKobo);
  const withdrawalFee = {
    standardKobo: integer(env, "WITHDRAWAL_FEE_KOBO", 2_500, 0),
    highKobo: integer(env, "WITHDRAWAL_FEE_HIGH_KOBO", 5_000, 0),
    highFromKobo: integer(env, "WITHDRAWAL_FEE_HIGH_FROM_KOBO", 5_000_000, 1),
  };

  if (Math.max(withdrawalFee.standardKobo, withdrawalFee.highKobo) >= withdrawalMinKobo) {
    fail("withdrawal fees must be below WITHDRAWAL_MIN_KOBO.");
  }

  const returnPath = text(env, "PAYMENTS_DEFAULT_RETURN_PATH") ?? "/wallet";

  if (!/^\/[A-Za-z0-9/_-]*$/u.test(returnPath) || returnPath.startsWith("//")) {
    fail("PAYMENTS_DEFAULT_RETURN_PATH must be a plain path such as /wallet.");
  }

  return Object.freeze({
    environment,
    activeProvider,
    paystack,
    flutterwave,
    callbackBaseUrl,
    defaultReturnPath: returnPath,
    providerTimeoutMs: integer(env, "PAYMENTS_PROVIDER_TIMEOUT_MS", 10_000, 500),
    depositMinKobo,
    depositMaxKobo,
    depositTtlMs: integer(env, "PAYMENTS_DEPOSIT_TTL_MINUTES", 30, 5) * 60_000,
    withdrawalMinKobo,
    withdrawalMaxKobo,
    withdrawalFee,
    withdrawalReviewThresholdKobo: integer(env, "WITHDRAWAL_REVIEW_THRESHOLD_KOBO", 50_000_000, 1),
    encryptionKey,
    encryptionKeyVersion,
    retiredEncryptionKeys,
    storage: storageOf(env),
    jobsEnabled: flag(env, "WALLET_JOBS_ENABLED", environment !== "test"),
    jobsIntervalMs: integer(env, "WALLET_JOBS_INTERVAL_MS", 30_000, 1_000),
    simulatedFundsEnabled,
  });
}

export function usesRealProvider(settings: PaymentSettings): boolean {
  return settings.activeProvider !== undefined && REAL_PROVIDERS.includes(settings.activeProvider);
}
