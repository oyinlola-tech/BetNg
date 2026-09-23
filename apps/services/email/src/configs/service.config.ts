import process from "node:process";
import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import { Secret } from "./secret.js";

export const SERVICE_NAME = "email" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3012;

const DEFAULT_BASE_URL = "https://api.sendbyte.africa";

const DEFAULT_TIMEOUT_MS = 10_000;

const MIN_TIMEOUT_MS = 500;

/** The `.env.example` values: public, so refused in production. */
const PLACEHOLDERS: readonly string[] = ["sk_live_replace_me", "whsec_replace_me"];

const API_KEY_PATTERN = /^sk_(live|test)_[A-Za-z0-9]{16,}$/u;

const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9_-]{16,}$/u;

export type EmailProviderId = "sendbyte" | "log";

export interface SendByteSettings {
  readonly apiKey: Secret;
  readonly baseUrl: string;
  /** Every secret currently valid for the endpoint. Two entries during a rotation window. */
  readonly webhookSecrets: readonly Secret[];
}

export interface EmailSettings {
  readonly provider: EmailProviderId;
  readonly sendbyte: SendByteSettings | undefined;
  readonly from: string;
  readonly fromName: string;
  readonly replyTo: string | undefined;
  readonly timeoutMs: number;
  readonly webhookToleranceSeconds: number;
}

export interface EmailConfig extends ServiceConfig {
  readonly email: EmailSettings;
}

type Env = Readonly<Record<string, string | undefined>>;

function fail(message: string): never {
  throw new Error(`Email configuration: ${message}`);
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
    fail(`${key} must be a whole number of at least ${String(minimum)}.`);
  }

  return value;
}

/** An address, lowercased. The display name travels separately so it can never smuggle a header. */
function address(env: Env, key: string, required: boolean): string | undefined {
  const raw = text(env, key)?.toLowerCase();

  if (raw === undefined) {
    if (required) {
      fail(`${key} is required.`);
    }

    return undefined;
  }

  if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/u.test(raw)) {
    fail(`${key} is not an email address.`);
  }

  return raw;
}

function baseUrl(env: Env, production: boolean): string {
  const raw = text(env, "SENDBYTE_BASE_URL") ?? DEFAULT_BASE_URL;
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    return fail("SENDBYTE_BASE_URL is not a URL.");
  }

  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);

  if (parsed.protocol !== "https:" && !(loopback && !production)) {
    fail("SENDBYTE_BASE_URL must be an https URL.");
  }

  if (parsed.username !== "" || parsed.password !== "" || parsed.search !== "" || parsed.hash !== "") {
    fail("SENDBYTE_BASE_URL must carry no credentials, query or fragment.");
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/u, "")}`;
}

function webhookSecrets(env: Env, production: boolean): readonly Secret[] {
  // Comma-separated so a rotation is a deployment with the old and the new secret, both accepted.
  const raw = text(env, "SENDBYTE_WEBHOOK_SECRET");

  if (raw === undefined) {
    if (production) {
      fail("SENDBYTE_WEBHOOK_SECRET is required: an unverified webhook is an anonymous write.");
    }

    return [];
  }

  const secrets = raw.split(",").map((part) => part.trim()).filter((part) => part !== "");

  for (const secret of secrets) {
    if (PLACEHOLDERS.includes(secret)) {
      fail("SENDBYTE_WEBHOOK_SECRET is the .env.example placeholder.");
    }

    if (!WEBHOOK_SECRET_PATTERN.test(secret)) {
      fail("SENDBYTE_WEBHOOK_SECRET is not a SendByte signing secret (whsec_…).");
    }
  }

  if (secrets.length === 0 && production) {
    fail("SENDBYTE_WEBHOOK_SECRET is required.");
  }

  return secrets.map((secret) => new Secret(secret));
}

function sendbyteOf(env: Env, production: boolean): SendByteSettings {
  const apiKey = text(env, "SENDBYTE_API_KEY");

  if (apiKey === undefined) {
    fail("EMAIL_SERVICE_PROVIDER=sendbyte needs SENDBYTE_API_KEY.");
  }

  if (PLACEHOLDERS.includes(apiKey)) {
    fail("SENDBYTE_API_KEY is the .env.example placeholder.");
  }

  if (!API_KEY_PATTERN.test(apiKey)) {
    fail("SENDBYTE_API_KEY is not a SendByte secret key.");
  }

  if (production && apiKey.startsWith("sk_test_")) {
    fail("SENDBYTE_API_KEY is a sandbox key; production needs a live key.");
  }

  return Object.freeze({
    apiKey: new Secret(apiKey),
    baseUrl: baseUrl(env, production),
    webhookSecrets: webhookSecrets(env, production),
  });
}

export async function loadEmailConfig(env?: Env): Promise<EmailConfig> {
  const base = await loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "EMAIL_DATABASE_URL",
    ...(env === undefined ? {} : { env }),
  });

  const source = env ?? process.env;
  const production = base.environment === "production";
  const provider = (text(source, "EMAIL_SERVICE_PROVIDER") ?? (production ? undefined : "log")) as EmailProviderId | undefined;

  if (provider === undefined) {
    fail("EMAIL_SERVICE_PROVIDER must be set in production (sendbyte).");
  }

  if (provider !== "sendbyte" && provider !== "log") {
    fail("EMAIL_SERVICE_PROVIDER must be sendbyte or log.");
  }

  if (production && provider === "log") {
    fail("EMAIL_SERVICE_PROVIDER=log records that a message was sent without sending it, and is refused in production.");
  }

  const fromName = text(source, "EMAIL_FROM_NAME") ?? "BetNG";

  if (fromName.length > 60 || /[\r\n<>,;"]/u.test(fromName)) {
    fail("EMAIL_FROM_NAME must be at most 60 characters and carry no header punctuation.");
  }

  return Object.freeze({
    ...base,
    email: Object.freeze({
      provider,
      sendbyte: provider === "sendbyte" ? sendbyteOf(source, production) : undefined,
      from: address(source, "EMAIL_FROM", provider === "sendbyte") ?? "no-reply@betng.test",
      fromName,
      replyTo: address(source, "EMAIL_REPLY_TO", false),
      timeoutMs: integer(source, "EMAIL_PROVIDER_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS),
      webhookToleranceSeconds: integer(source, "EMAIL_WEBHOOK_TOLERANCE_SECONDS", 300, 30),
    }),
  });
}
