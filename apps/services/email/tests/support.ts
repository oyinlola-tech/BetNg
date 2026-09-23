import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { parseEnv } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { createApp, loadEmailConfig } from "../src/index.js";
import type { EmailApp } from "../src/index.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { DeliveryEvent, EmailProvider, OutboundEmail, SendResult } from "../src/providers/index.js";
import { WebhookRejectedError } from "../src/providers/index.js";

export const TEST_DATABASE = "betng_test_email";

export const TEST_PORT = 4112;

const envFile = resolve(import.meta.dirname, "../../../../.env");

// Parsed, not loaded: the tests must not inherit INTERNAL_SERVICE_TOKEN or a real provider key.
const env: Readonly<Record<string, string | undefined>> = {
  ...(existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {}),
  ...process.env,
};

delete process.env["INTERNAL_SERVICE_TOKEN"];

export function serviceUrl(): string {
  const configured = env["EMAIL_DATABASE_URL"];

  if (configured === undefined) {
    throw new Error("EMAIL_DATABASE_URL is not set.");
  }

  const url = new URL(configured);

  url.pathname = `/${TEST_DATABASE}`;

  return url.toString();
}

/** A production config needs these present before its refusals can be reached. */
export const PRODUCTION_REQUIREMENTS: Readonly<Record<string, string>> = Object.freeze({
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  EMAIL_PORT: String(TEST_PORT),
  LOG_LEVEL: "fatal",
  EMAIL_DATABASE_URL: "postgresql://betng_email:secret@db:5432/betng?schema=email",
  INTERNAL_SERVICE_TOKEN: "an-internal-token-long-enough-for-production",
  EMAIL_SERVICE_PROVIDER: "sendbyte",
  SENDBYTE_API_KEY: "sk_live_abcdefghijklmnop0123",
  SENDBYTE_WEBHOOK_SECRET: "whsec_abcdefghijklmnop0123",
  EMAIL_FROM: "no-reply@betng.example",
});

export interface RecordedEmail extends OutboundEmail {
  readonly providerId: string;
}

/** Stands in for SendByte. Records what it was asked to send and can be told to fail. */
export class FakeProvider implements EmailProvider {
  public readonly id = "fake";

  public readonly configured = true;

  public readonly sent: RecordedEmail[] = [];

  public failWith: Error | undefined;

  public nextEvent: DeliveryEvent | undefined;

  public signatureValid = true;

  public send(message: OutboundEmail): Promise<SendResult> {
    if (this.failWith !== undefined) {
      return Promise.reject(this.failWith);
    }

    const providerId = `em_${randomUUID().replaceAll("-", "").slice(0, 20)}`;

    this.sent.push({ ...message, providerId });

    return Promise.resolve({ providerId, providerStatus: "queued" });
  }

  public parseWebhook(): DeliveryEvent {
    if (!this.signatureValid) {
      throw new WebhookRejectedError("Fake signature mismatch.");
    }

    if (this.nextEvent === undefined) {
      throw new WebhookRejectedError("No event was queued.");
    }

    return this.nextEvent;
  }

  public probe(): Promise<void> {
    return Promise.resolve();
  }

  public last(): RecordedEmail {
    const message = this.sent.at(-1);

    if (message === undefined) {
      throw new Error("No email was sent.");
    }

    return message;
  }
}

export interface Harness {
  readonly app: EmailApp;
  readonly provider: FakeProvider;
  readonly prisma: PrismaClient;
  readonly reset: () => Promise<void>;
  readonly close: () => Promise<void>;
}

export async function createHarness(provider: FakeProvider = new FakeProvider()): Promise<Harness> {
  const config = await loadEmailConfig({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    EMAIL_PORT: String(TEST_PORT),
    LOG_LEVEL: "fatal",
    EMAIL_DATABASE_URL: serviceUrl(),
    EMAIL_SERVICE_PROVIDER: "log",
    EMAIL_FROM: "no-reply@betng.test",
  });

  const app = createApp(config, { provider });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: serviceUrl() }, { schema: "email" }),
  });

  const reset = async (): Promise<void> => {
    // The triggers refuse DELETE, so a reset is a superuser-level TRUNCATE-free wipe through the owner
    // role with the guards momentarily disabled. Test data only; the guards are proven by their own test.
    await prisma.$executeRawUnsafe('ALTER TABLE "email"."email_events" DISABLE TRIGGER USER');
    await prisma.$executeRawUnsafe('ALTER TABLE "email"."email_messages" DISABLE TRIGGER USER');
    await prisma.$executeRawUnsafe('DELETE FROM "email"."email_events"');
    await prisma.$executeRawUnsafe('DELETE FROM "email"."email_messages"');
    await prisma.$executeRawUnsafe('DELETE FROM "email"."email_suppressions"');
    await prisma.$executeRawUnsafe('ALTER TABLE "email"."email_messages" ENABLE TRIGGER USER');
    await prisma.$executeRawUnsafe('ALTER TABLE "email"."email_events" ENABLE TRIGGER USER');

    provider.sent.length = 0;
    provider.failWith = undefined;
    provider.nextEvent = undefined;
    provider.signatureValid = true;
  };

  await reset();
  await app.prepare();

  return {
    app,
    provider,
    prisma,
    reset,
    close: async () => {
      for (const release of app.onShutdown) {
        await release();
      }

      await prisma.$disconnect();
    },
  };
}

export const key = (): string => `test-${randomUUID()}`;
