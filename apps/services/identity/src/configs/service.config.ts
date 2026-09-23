import { createHash } from "node:crypto";
import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import { z } from "@zudojs/validation";
import { readVapidKeys } from "../services/delivery/webPush.crypto.js";
import type { VapidKeys } from "../services/delivery/webPush.crypto.js";

export const SERVICE_NAME = "identity" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3010;

export interface SecurityConfig {
  readonly customerSessionTtlHours: number;
  /** Absolute lifetime of a customer session; refreshing never extends past it. */
  readonly customerSessionMaxHours: number;
  readonly cashierSessionTtlHours: number;
  readonly adminSessionTtlHours: number;
  /** Outside production only: a fixed code accepted in place of the issued one. Unset by default. */
  readonly devVerificationCode: string | undefined;
  /** Issued codes are logged in development and test when asked for, never in production. */
  readonly logVerificationCodes: boolean;
  readonly seedAdminTotpSecret: string | undefined;
  /** Opt-in, development and test only; production refuses to start with it set. */
  readonly seedDemoData: boolean;
  /** An admin without two-factor authentication cannot sign in. */
  readonly adminTotpRequired: boolean;
  readonly passwordBreachCheck: boolean;
  readonly deletionCoolingDays: number;
}

/** Identity sends no mail itself: `service` hands it to the email service, `log` is development only. */
export type EmailProviderConfig = "service" | "log";

export type SmsProviderConfig =
  | { readonly provider: "none" }
  | { readonly provider: "log" }
  | {
      readonly provider: "termii";
      readonly apiKey: string;
      readonly senderId: string;
      readonly baseUrl: string;
      readonly channel: "dnd" | "generic";
    };

export type PushProviderConfig =
  | { readonly provider: "none" }
  | { readonly provider: "log" }
  | { readonly provider: "fcm"; readonly projectId: string; readonly clientEmail: string; readonly privateKey: string };

export interface WebPushConfig {
  readonly keys: VapidKeys;
}

export interface DeliveryConfig {
  readonly email: EmailProviderConfig;
  readonly sms: SmsProviderConfig;
  readonly push: PushProviderConfig;
  /** Undefined when VAPID is not configured: web subscriptions are then not sent to. */
  readonly webPush: WebPushConfig | undefined;
  readonly timeoutMs: number;
}

/** Server-side encryption a stored document is written under. */
export interface StorageEncryption {
  readonly algorithm: "AES256" | "aws:kms";
  /** The KMS key id or ARN; set only for `aws:kms`. */
  readonly kmsKeyId: string | undefined;
}

export interface StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
  /** Undefined only outside production: documents are then written unencrypted. */
  readonly encryption: StorageEncryption | undefined;
}

export interface KycConfig {
  /** Undefined when object storage is not configured: uploads answer 503 instead of a ticket. */
  readonly storage: StorageConfig | undefined;
  readonly identityProvider: "sandbox" | "unconfigured";
}

export interface IdentityConfig {
  readonly service: ServiceConfig;
  readonly security: SecurityConfig;
  readonly delivery: DeliveryConfig;
  readonly kyc: KycConfig;
  /** 32 bytes. TOTP secrets and push tokens are encrypted, and BVN/NIN and backup codes hashed, with keys derived from it. */
  readonly dataKey: Buffer;
}

/** What development and tests use when IDENTITY_DATA_KEY is unset. Public, so production refuses it. */
export const DEVELOPMENT_DATA_KEY = createHash("sha256").update("betng-local-development-identity-data-key").digest();

const ttlHours = (fallback: number): z.ZodType<number> =>
  z.coerce.number().int().min(1).max(24 * 90).default(fallback);

const blankAsUnset = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankAsUnset, schema.optional());

const flag = (fallback: "true" | "false") => z.preprocess(blankAsUnset, z.enum(["true", "false"]).default(fallback));

const httpsUrl = z.url({ protocol: /^https$/u });

const securityEnvSchema = z.object({
  CUSTOMER_SESSION_TTL_HOURS: z.preprocess(blankAsUnset, ttlHours(168)),
  CUSTOMER_SESSION_MAX_HOURS: z.preprocess(blankAsUnset, ttlHours(720)),
  CASHIER_SESSION_TTL_HOURS: z.preprocess(blankAsUnset, ttlHours(12)),
  ADMIN_SESSION_TTL_HOURS: z.preprocess(blankAsUnset, ttlHours(8)),
  DEV_VERIFICATION_CODE: optional(z.string().regex(/^\d{6}$/u, "must be six digits")),
  SEED_DEMO_DATA: flag("false"),
  LOG_VERIFICATION_CODES: flag("false"),
  SEED_ADMIN_TOTP_SECRET: optional(z.string().regex(/^[A-Z2-7]{16,64}$/u, "must be 16-64 base32 characters")),
  ADMIN_TOTP_REQUIRED: optional(z.enum(["true", "false"])),
  PASSWORD_BREACH_CHECK: flag("false"),
  ACCOUNT_DELETION_COOLING_DAYS: z.preprocess(blankAsUnset, z.coerce.number().int().min(1).max(90).default(14)),
  IDENTITY_DATA_KEY: optional(z.base64()),
  EMAIL_PROVIDER: optional(z.enum(["log", "service"])),
  SMS_PROVIDER: optional(z.enum(["none", "log", "termii"])),
  TERMII_API_KEY: optional(z.string().min(10)),
  TERMII_SENDER_ID: optional(z.string().regex(/^[A-Za-z0-9 ]{3,11}$/u, "must be 3-11 letters or digits")),
  TERMII_BASE_URL: optional(httpsUrl),
  TERMII_CHANNEL: z.preprocess(blankAsUnset, z.enum(["dnd", "generic"]).default("dnd")),
  PUSH_PROVIDER: optional(z.enum(["none", "log", "fcm"])),
  FCM_PROJECT_ID: optional(z.string().regex(/^[a-z0-9-]{4,40}$/u)),
  FCM_CLIENT_EMAIL: optional(z.email()),
  FCM_PRIVATE_KEY: optional(z.string().min(100)),
  VAPID_PUBLIC_KEY: optional(z.string().max(200)),
  VAPID_PRIVATE_KEY: optional(z.string().max(200)),
  VAPID_SUBJECT: optional(z.string().max(200).regex(/^(?:mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/u, "must be a mailto: or https: URL")),
  DELIVERY_TIMEOUT_MS: z.preprocess(blankAsUnset, z.coerce.number().int().min(500).max(30_000).default(8000)),
  KYC_STORAGE_ENDPOINT: optional(httpsUrl),
  KYC_STORAGE_REGION: optional(z.string().regex(/^[a-z0-9-]{2,32}$/u)),
  KYC_STORAGE_BUCKET: optional(z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u)),
  KYC_STORAGE_ACCESS_KEY_ID: optional(z.string().min(8)),
  KYC_STORAGE_SECRET_ACCESS_KEY: optional(z.string().min(16)),
  KYC_STORAGE_SSE: optional(z.enum(["AES256", "aws:kms"])),
  KYC_STORAGE_SSE_KMS_KEY_ID: optional(z.string().min(1).max(2048)),
  KYC_STORAGE_FORCE_PATH_STYLE: flag("true"),
  KYC_IDENTITY_PROVIDER: optional(z.enum(["sandbox", "unconfigured"])),
});

type SecurityEnv = z.infer<typeof securityEnvSchema>;

class ConfigProblems {
  private readonly problems: string[] = [];

  public add(problem: string): void {
    this.problems.push(problem);
  }

  public require<T>(env: SecurityEnv, key: keyof SecurityEnv, because: string): T {
    const value = env[key];

    if (value === undefined) {
      this.problems.push(`${key} is required ${because}`);
    }

    return value as T;
  }

  public throwIfAny(): void {
    if (this.problems.length > 0) {
      throw new Error(`Invalid identity configuration: ${this.problems.join("; ")}.`);
    }
  }
}

function readDataKey(env: SecurityEnv, production: boolean, problems: ConfigProblems): Buffer {
  if (env.IDENTITY_DATA_KEY === undefined) {
    if (production) {
      problems.add("IDENTITY_DATA_KEY is required in production");
    }

    return DEVELOPMENT_DATA_KEY;
  }

  const key = Buffer.from(env.IDENTITY_DATA_KEY, "base64");

  if (key.length !== 32) {
    problems.add("IDENTITY_DATA_KEY must be 32 bytes, base64 encoded");
  } else if (production && key.equals(DEVELOPMENT_DATA_KEY)) {
    problems.add("IDENTITY_DATA_KEY is the development key");
  }

  return key;
}

function readDelivery(env: SecurityEnv, production: boolean, problems: ConfigProblems): DeliveryConfig {
  const emailProvider = env.EMAIL_PROVIDER ?? (production ? "service" : "log");
  const smsProvider = env.SMS_PROVIDER ?? "none";
  const pushProvider = env.PUSH_PROVIDER ?? "none";

  if (production) {
    for (const [key, value] of [["EMAIL_PROVIDER", emailProvider], ["SMS_PROVIDER", smsProvider], ["PUSH_PROVIDER", pushProvider]] as const) {
      if (value === "log") {
        problems.add(`${key}=log is a development adapter and is refused in production`);
      }
    }
  }

  const email: EmailProviderConfig = emailProvider;

  const sms: SmsProviderConfig =
    smsProvider === "termii"
      ? {
          provider: "termii",
          apiKey: problems.require(env, "TERMII_API_KEY", "when SMS_PROVIDER=termii"),
          senderId: problems.require(env, "TERMII_SENDER_ID", "when SMS_PROVIDER=termii"),
          baseUrl: problems.require(env, "TERMII_BASE_URL", "when SMS_PROVIDER=termii"),
          channel: env.TERMII_CHANNEL,
        }
      : { provider: smsProvider };

  const push: PushProviderConfig =
    pushProvider === "fcm"
      ? {
          provider: "fcm",
          projectId: problems.require(env, "FCM_PROJECT_ID", "when PUSH_PROVIDER=fcm"),
          clientEmail: problems.require(env, "FCM_CLIENT_EMAIL", "when PUSH_PROVIDER=fcm"),
          privateKey: (problems.require<string | undefined>(env, "FCM_PRIVATE_KEY", "when PUSH_PROVIDER=fcm") ?? "").replaceAll("\\n", "\n"),
        }
      : { provider: pushProvider };

  return { email, sms, push, webPush: readWebPush(env, problems), timeoutMs: env.DELIVERY_TIMEOUT_MS };
}

const VAPID_KEYS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

/** All three or none, in every environment: a half configuration would silently drop browser notifications. */
function readWebPush(env: SecurityEnv, problems: ConfigProblems): WebPushConfig | undefined {
  const present = VAPID_KEYS.filter((key) => env[key] !== undefined);

  if (present.length === 0) {
    return undefined;
  }

  if (present.length !== VAPID_KEYS.length) {
    for (const key of VAPID_KEYS) {
      if (env[key] === undefined) {
        problems.add(`${key} is required once any VAPID_* variable is set`);
      }
    }

    return undefined;
  }

  const keys = readVapidKeys(env.VAPID_PUBLIC_KEY ?? "", env.VAPID_PRIVATE_KEY ?? "", env.VAPID_SUBJECT ?? "");

  if (keys === undefined) {
    problems.add("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be one P-256 key pair, base64url (65-byte uncompressed public, 32-byte private)");

    return undefined;
  }

  return { keys };
}

const STORAGE_KEYS = [
  "KYC_STORAGE_ENDPOINT",
  "KYC_STORAGE_REGION",
  "KYC_STORAGE_BUCKET",
  "KYC_STORAGE_ACCESS_KEY_ID",
  "KYC_STORAGE_SECRET_ACCESS_KEY",
] as const;

function readKyc(env: SecurityEnv, production: boolean, problems: ConfigProblems): KycConfig {
  const provider = env.KYC_IDENTITY_PROVIDER ?? (production ? "unconfigured" : "sandbox");

  if (production && provider === "sandbox") {
    problems.add("KYC_IDENTITY_PROVIDER=sandbox is a development adapter and is refused in production");
  }

  const present = STORAGE_KEYS.filter((key) => env[key] !== undefined);

  if (present.length === 0) {
    return { storage: undefined, identityProvider: provider };
  }

  for (const key of STORAGE_KEYS) {
    if (env[key] === undefined) {
      problems.add(`${key} is required once any KYC_STORAGE_* variable is set`);
    }
  }

  return {
    identityProvider: provider,
    storage: {
      endpoint: (env.KYC_STORAGE_ENDPOINT ?? "").replace(/\/+$/u, ""),
      region: env.KYC_STORAGE_REGION ?? "",
      bucket: env.KYC_STORAGE_BUCKET ?? "",
      accessKeyId: env.KYC_STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.KYC_STORAGE_SECRET_ACCESS_KEY ?? "",
      forcePathStyle: env.KYC_STORAGE_FORCE_PATH_STYLE === "true",
      encryption: readStorageEncryption(env, production, problems),
    },
  };
}

/**
 * Identity documents are written under server-side encryption. The upload ticket
 * signs the header, so a client that drops it is refused by storage rather than
 * quietly storing a passport scan in the clear.
 */
function readStorageEncryption(
  env: SecurityEnv,
  production: boolean,
  problems: ConfigProblems,
): StorageEncryption | undefined {
  const algorithm = env.KYC_STORAGE_SSE;
  const kmsKeyId = env.KYC_STORAGE_SSE_KMS_KEY_ID;

  if (algorithm === undefined) {
    if (production) {
      problems.add("KYC_STORAGE_SSE is required in production once KYC storage is configured");
    }

    return undefined;
  }

  if (algorithm === "aws:kms" && kmsKeyId === undefined) {
    problems.add("KYC_STORAGE_SSE_KMS_KEY_ID is required when KYC_STORAGE_SSE=aws:kms");
  }

  if (algorithm === "AES256" && kmsKeyId !== undefined) {
    problems.add("KYC_STORAGE_SSE_KMS_KEY_ID is only used when KYC_STORAGE_SSE=aws:kms");
  }

  return { algorithm, kmsKeyId: algorithm === "aws:kms" ? kmsKeyId : undefined };
}

export async function loadIdentityConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<IdentityConfig> {
  const loaded = await loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "IDENTITY_DATABASE_URL",
    usesRedis: true,
    env,
  });

  const service: ServiceConfig = Object.freeze({
    ...loaded,
    redisUrl: loaded.redisUrl === undefined || loaded.redisUrl.trim() === "" ? undefined : loaded.redisUrl,
  });

  const parsed = securityEnvSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid identity configuration: ${problems}.`);
  }

  const data = parsed.data;
  const production = service.environment === "production";
  const problems = new ConfigProblems();

  // Forced off in production anyway; refusing to start makes a leaked development flag visible instead of silent.
  if (production && data.SEED_DEMO_DATA === "true") {
    problems.add("SEED_DEMO_DATA=true creates accounts with published passwords and is refused in production");
  }

  if (production && service.redisUrl === undefined) {
    problems.add("REDIS_URL is required in production: revoked sessions must be evicted from the gateway cache");
  }

  const dataKey = readDataKey(data, production, problems);
  const delivery = readDelivery(data, production, problems);
  const kyc = readKyc(data, production, problems);

  if (data.CUSTOMER_SESSION_MAX_HOURS < data.CUSTOMER_SESSION_TTL_HOURS) {
    problems.add("CUSTOMER_SESSION_MAX_HOURS must be at least CUSTOMER_SESSION_TTL_HOURS");
  }

  problems.throwIfAny();

  return Object.freeze({
    service,
    dataKey,
    delivery: Object.freeze(delivery),
    kyc: Object.freeze(kyc),
    security: Object.freeze({
      customerSessionTtlHours: data.CUSTOMER_SESSION_TTL_HOURS,
      customerSessionMaxHours: data.CUSTOMER_SESSION_MAX_HOURS,
      cashierSessionTtlHours: data.CASHIER_SESSION_TTL_HOURS,
      adminSessionTtlHours: data.ADMIN_SESSION_TTL_HOURS,
      devVerificationCode: production ? undefined : data.DEV_VERIFICATION_CODE,
      logVerificationCodes: !production && data.LOG_VERIFICATION_CODES === "true",
      seedDemoData: !production && data.SEED_DEMO_DATA === "true",
      seedAdminTotpSecret: production ? undefined : data.SEED_ADMIN_TOTP_SECRET,
      adminTotpRequired: (data.ADMIN_TOTP_REQUIRED ?? (production ? "true" : "false")) === "true",
      passwordBreachCheck: data.PASSWORD_BREACH_CHECK === "true",
      deletionCoolingDays: data.ACCOUNT_DELETION_COOLING_DAYS,
    }),
  });
}
