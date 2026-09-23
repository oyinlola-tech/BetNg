import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadEmailConfig } from "../src/index.js";
import { findTemplate, TEMPLATE_NAMES } from "../src/templates/index.js";
import { addressHash } from "../src/utils/index.js";
import { ProviderRefusedError, ProviderUnavailableError } from "../src/providers/index.js";
import { createHarness, key, PRODUCTION_REQUIREMENTS } from "./support.js";
import type { Harness } from "./support.js";

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness();
});

beforeEach(async () => {
  await harness.reset();
});

afterAll(async () => {
  await harness.close();
});

const send = async (overrides: Partial<Parameters<Harness["app"]["delivery"]["send"]>[0]> = {}) =>
  harness.app.delivery.send({
    to: "Ada@Example.TEST",
    template: "verification_code",
    variables: { code: "482913", expiresInMinutes: "15" },
    idempotencyKey: key(),
    ...overrides,
  });

describe("sending", () => {
  it("renders, records and hands the message to the provider", async () => {
    const outcome = await send();

    expect(outcome.duplicate).toBe(false);
    expect(outcome.status).toBe("SENT");

    const message = harness.provider.last();

    expect(message.to).toBe("ada@example.test");
    expect(message.subject).toBe("Your BetNG verification code");
    expect(message.html).toContain("482913");
    expect(message.text).toContain("482913");
  });

  it("never writes a code, a password or a PIN to the stored variables", async () => {
    const outcome = await send();
    const stored = await harness.prisma.emailMessage.findUniqueOrThrow({ where: { id: outcome.id } });

    expect(stored.variables).toEqual({ expiresInMinutes: "15" });
    expect(JSON.stringify(stored)).not.toContain("482913");

    const credentials = await send({
      template: "cashier_credentials",
      variables: {
        displayName: "Bisi Adeyemi",
        shopCode: "BNG-LAG-001",
        username: "bisi",
        temporaryPassword: "Kq7mRt2wXy9aBc",
        temporaryPin: "418203",
        expiresInHours: "24",
      },
    });
    const row = await harness.prisma.emailMessage.findUniqueOrThrow({ where: { id: credentials.id } });

    expect(JSON.stringify(row)).not.toContain("Kq7mRt2wXy9aBc");
    expect(JSON.stringify(row)).not.toContain("418203");
    // The rendered body carries them; the row never does.
    expect(harness.provider.last().text).toContain("Kq7mRt2wXy9aBc");
  });

  it("stores the address lowercased and keeps no rendered body", async () => {
    const outcome = await send({ to: "MIXED.Case@Example.Test" });
    const stored = await harness.prisma.emailMessage.findUniqueOrThrow({ where: { id: outcome.id } });

    expect(stored.toAddress).toBe("mixed.case@example.test");
    expect(stored.toHash).toBe(addressHash("mixed.case@example.test"));
    expect(Object.keys(stored)).not.toContain("html");
  });

  it("is idempotent: a repeated key returns the first message and sends nothing more", async () => {
    const idempotencyKey = key();
    const first = await send({ idempotencyKey });
    const second = await send({ idempotencyKey });

    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
    expect(harness.provider.sent).toHaveLength(1);
  });

  it("hands the same key to the provider, so a provider-side retry collapses too", async () => {
    const idempotencyKey = key();

    await send({ idempotencyKey });

    expect(harness.provider.last().idempotencyKey).toBe(idempotencyKey);
  });

  it("refuses an unknown template and a template missing a variable", async () => {
    await expect(send({ template: "no_such_template" })).rejects.toThrow(/no email template/i);
    await expect(send({ variables: { expiresInMinutes: "15" } })).rejects.toThrow(/needs a code value/i);
  });

  it("records a refusal against the message and reports it as a 422", async () => {
    harness.provider.failWith = new ProviderRefusedError("fake", 422, "suppressed_recipient");

    const idempotencyKey = key();

    await expect(send({ idempotencyKey })).rejects.toThrow(/refused the message/i);

    const stored = await harness.prisma.emailMessage.findUniqueOrThrow({ where: { idempotencyKey } });

    expect(stored.status).toBe("FAILED");
    expect(stored.failureReason).toBe("refused:422:suppressed_recipient");
  });

  it("reports an unreachable provider as a 503 and leaves the message failed", async () => {
    harness.provider.failWith = new ProviderUnavailableError("fake", "timed out");

    await expect(send()).rejects.toThrow(/could not be reached/i);
  });
});

describe("suppressions", () => {
  it("refuses an address that bounced, whatever the spelling", async () => {
    await harness.prisma.emailSuppression.create({
      data: {
        addressHash: addressHash("ada@example.test"),
        address: "ada@example.test",
        reason: "BOUNCE",
        source: "test",
      },
    });

    await expect(send({ to: "ADA@example.test" })).rejects.toThrow(/suppression list/i);
    expect(harness.provider.sent).toHaveLength(0);
  });
});

describe("webhooks", () => {
  const raw = new TextEncoder().encode("{}");
  const header = (): string | undefined => undefined;

  it("refuses a webhook whose signature does not verify", async () => {
    harness.provider.signatureValid = false;

    await expect(harness.app.delivery.handleWebhook(raw, header)).rejects.toThrow(/signature/i);
  });

  it("applies a delivery event once and treats a replay as a duplicate", async () => {
    const outcome = await send();
    const providerId = harness.provider.last().providerId;

    harness.provider.nextEvent = {
      eventId: "evt_delivered_1",
      eventType: "email.delivered",
      providerId,
      outcome: "DELIVERED",
      occurredAt: new Date(),
      address: "ada@example.test",
      permanent: false,
    };

    expect(await harness.app.delivery.handleWebhook(raw, header)).toBe("applied");
    expect(await harness.app.delivery.handleWebhook(raw, header)).toBe("duplicate");

    const stored = await harness.prisma.emailMessage.findUniqueOrThrow({ where: { id: outcome.id } });

    expect(stored.status).toBe("DELIVERED");
  });

  it("never walks a delivered message backwards", async () => {
    const outcome = await send();
    const providerId = harness.provider.last().providerId;

    for (const [eventId, type, result] of [
      ["evt_a", "email.delivered", "DELIVERED"],
      ["evt_b", "email.sent", "SENT"],
    ] as const) {
      harness.provider.nextEvent = {
        eventId,
        eventType: type,
        providerId,
        outcome: result,
        occurredAt: new Date(),
        address: undefined,
        permanent: false,
      };

      await harness.app.delivery.handleWebhook(raw, header);
    }

    const stored = await harness.prisma.emailMessage.findUniqueOrThrow({ where: { id: outcome.id } });

    expect(stored.status).toBe("DELIVERED");
  });

  it("suppresses the address on a permanent bounce, even with no message to tie it to", async () => {
    harness.provider.nextEvent = {
      eventId: "evt_bounce_1",
      eventType: "email.bounced",
      providerId: undefined,
      outcome: "BOUNCED",
      occurredAt: new Date(),
      address: "gone@example.test",
      permanent: true,
    };

    expect(await harness.app.delivery.handleWebhook(raw, header)).toBe("unknown_message");

    const suppression = await harness.prisma.emailSuppression.findUnique({
      where: { addressHash: addressHash("gone@example.test") },
    });

    expect(suppression?.reason).toBe("BOUNCE");
  });

  it("leaves a soft bounce alone", async () => {
    harness.provider.nextEvent = {
      eventId: "evt_soft_1",
      eventType: "email.bounced",
      providerId: undefined,
      outcome: "BOUNCED",
      occurredAt: new Date(),
      address: "busy@example.test",
      permanent: false,
    };

    await harness.app.delivery.handleWebhook(raw, header);

    expect(
      await harness.prisma.emailSuppression.findUnique({ where: { addressHash: addressHash("busy@example.test") } }),
    ).toBeNull();
  });
});

describe("templates", () => {
  it.each(TEMPLATE_NAMES)("%s escapes a variable rather than letting it become markup", (name) => {
    const template = findTemplate(name);

    if (template === undefined) {
      throw new Error(`${name} is not registered.`);
    }

    const variables = Object.fromEntries(
      [...template.required, "reason", "footer"].map((variable) => [variable, '<script>alert("x")</script>']),
    );
    const rendered = template.render({ ...variables, decision: "REJECTED", expiresInMinutes: "15" });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.text.length).toBeGreaterThan(0);
  });

  it("declares every secret-bearing template's secret variables", () => {
    for (const name of ["verification_code", "password_reset_code", "cashier_credentials", "shop_owner_credentials", "admin_credentials"]) {
      expect(findTemplate(name)?.secretVariables.length).toBeGreaterThan(0);
    }
  });
});

describe("configuration", () => {
  const production = async (overrides: Readonly<Record<string, string | undefined>>) =>
    loadEmailConfig({ ...PRODUCTION_REQUIREMENTS, ...overrides });

  it("refuses the log adapter in production", async () => {
    await expect(production({ EMAIL_SERVICE_PROVIDER: "log" })).rejects.toThrow(/refused in production/i);
  });

  it("refuses a sandbox key in production", async () => {
    await expect(production({ SENDBYTE_API_KEY: "sk_test_abcdefghijklmnop0123" })).rejects.toThrow(/live key/i);
  });

  it("refuses a missing webhook secret in production", async () => {
    await expect(production({ SENDBYTE_WEBHOOK_SECRET: undefined })).rejects.toThrow(/WEBHOOK_SECRET is required/i);
  });

  it("refuses a plain-http provider URL", async () => {
    await expect(production({ SENDBYTE_BASE_URL: "http://api.sendbyte.africa" })).rejects.toThrow(/https/i);
  });

  it("refuses a from-name that could forge a header", async () => {
    await expect(production({ EMAIL_FROM_NAME: 'Bet"NG <evil@example.com>' })).rejects.toThrow(/header punctuation/i);
  });

  it("keeps the api key out of anything printable", async () => {
    const config = await production({});
    const secret = config.email.sendbyte?.apiKey;

    expect(String(secret)).toBe("[redacted]");
    expect(JSON.stringify(config.email)).not.toContain("sk_live_");
    expect(secret?.reveal()).toBe(PRODUCTION_REQUIREMENTS["SENDBYTE_API_KEY"]);
  });
});
