import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Secret } from "../src/configs/index.js";
import { createSendByteProvider, ProviderRefusedError, ProviderUnavailableError } from "../src/providers/index.js";
import type { EmailProvider } from "../src/providers/index.js";

const WEBHOOK_SECRET = "whsec_0123456789abcdef0123456789";

interface Recorded {
  readonly path: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string;
}

let server: Server;
let baseUrl: string;
let provider: EmailProvider;
const received: Recorded[] = [];
let reply: { status: number; body: string } = { status: 201, body: "" };

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        path: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(reply.status, { "content-type": "application/json" });
      response.end(reply.body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;

  provider = createSendByteProvider({
    settings: {
      apiKey: new Secret("sk_test_abcdefghijklmnop0123"),
      baseUrl,
      webhookSecrets: [new Secret(WEBHOOK_SECRET)],
    },
    from: "no-reply@betng.test",
    fromName: "BetNG",
    timeoutMs: 2000,
    toleranceSeconds: 300,
  });
});

beforeEach(() => {
  received.length = 0;
  reply = { status: 201, body: JSON.stringify({ id: "em_abc123", status: "queued" }) };
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const message = (overrides: Partial<Parameters<EmailProvider["send"]>[0]> = {}) => ({
  to: "ada@example.test",
  subject: "Your BetNG verification code",
  html: "<p>482913</p>",
  text: "482913",
  replyTo: undefined,
  tags: [] as readonly string[],
  idempotencyKey: `key-${randomUUID()}`,
  ...overrides,
});

const signed = (body: string, secret = WEBHOOK_SECRET, at = Math.floor(Date.now() / 1000)): string =>
  `t=${String(at)},v1=${createHmac("sha256", secret).update(`${String(at)}.${body}`).digest("hex")}`;

describe("sendbyte send", () => {
  it("posts to /v1/emails with the bearer key and the idempotency header", async () => {
    const outgoing = message();
    const result = await provider.send(outgoing);

    expect(result.providerId).toBe("em_abc123");
    expect(result.providerStatus).toBe("queued");

    const request = received[0];

    expect(request?.path).toBe("/v1/emails");
    expect(request?.headers["authorization"]).toBe("Bearer sk_test_abcdefghijklmnop0123");
    expect(request?.headers["idempotency-key"]).toBe(outgoing.idempotencyKey);

    const body = JSON.parse(request?.body ?? "{}") as Record<string, unknown>;

    expect(body["from"]).toBe("BetNG <no-reply@betng.test>");
    expect(body["to"]).toBe("ada@example.test");
    expect(body["html"]).toBe("<p>482913</p>");
    expect(body["text"]).toBe("482913");
    // Open and click tracking would rewrite the links in a code email and add a pixel.
    expect(body["tracking"]).toEqual({ opens: false, clicks: false });
  });

  it("treats a 4xx as a refusal and keeps only the status and code", async () => {
    reply = { status: 422, body: JSON.stringify({ error: { code: "suppressed_recipient", message: "ada@example.test is suppressed" } }) };

    await expect(provider.send(message())).rejects.toMatchObject({
      name: "ProviderRefusedError",
      status: 422,
      code: "suppressed_recipient",
    });

    await expect(provider.send(message())).rejects.toSatisfy(
      (error: unknown) => error instanceof ProviderRefusedError && !error.message.includes("ada@example.test"),
    );
  });

  it("treats a 5xx and a 429 as retryable", async () => {
    for (const status of [500, 502, 429]) {
      reply = { status, body: "{}" };

      await expect(provider.send(message())).rejects.toBeInstanceOf(ProviderUnavailableError);
    }
  });

  it("treats a non-JSON body as unavailable rather than guessing", async () => {
    reply = { status: 201, body: "<html>maintenance</html>" };

    await expect(provider.send(message())).rejects.toBeInstanceOf(ProviderUnavailableError);
  });
});

describe("sendbyte webhook", () => {
  const body = JSON.stringify({
    id: "evt_1",
    type: "email.delivered",
    created_at: "2026-09-22T10:00:00Z",
    data: { email_id: "em_abc123", to: "Ada@Example.Test" },
  });
  const raw = new TextEncoder().encode(body);
  const header = (value: string | undefined) => (name: string) => (name === "sendbyte-signature" ? value : undefined);

  it("accepts a correctly signed delivery and normalises the address", () => {
    const event = provider.parseWebhook(raw, header(signed(body)));

    expect(event).toMatchObject({
      eventId: "evt_1",
      eventType: "email.delivered",
      providerId: "em_abc123",
      outcome: "DELIVERED",
      address: "ada@example.test",
    });
    expect(event.occurredAt?.toISOString()).toBe("2026-09-22T10:00:00.000Z");
  });

  it("refuses a body changed after signing", () => {
    const signature = signed(body);
    const tampered = new TextEncoder().encode(body.replace("evt_1", "evt_2"));

    expect(() => provider.parseWebhook(tampered, header(signature))).toThrow(/signature mismatch/i);
  });

  it("refuses a stale signature, a missing header and a wrong secret", () => {
    expect(() => provider.parseWebhook(raw, header(signed(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 400)))).toThrow(/stale/i);
    expect(() => provider.parseWebhook(raw, header(undefined))).toThrow(/missing/i);
    expect(() => provider.parseWebhook(raw, header(signed(body, "whsec_someoneelsessecret0000")))).toThrow(/mismatch/i);
  });

  it("never reports the expected signature back to the caller", () => {
    try {
      provider.parseWebhook(raw, header(signed(body, "whsec_someoneelsessecret0000")));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toMatch(/[0-9a-f]{64}/u);
    }
  });

  it("marks a soft bounce as recoverable and anything else as permanent", () => {
    const soft = JSON.stringify({ id: "evt_s", type: "email.bounced", data: { bounce_type: "soft", to: "a@b.test" } });
    const hard = JSON.stringify({ id: "evt_h", type: "email.bounced", data: { bounce_type: "hard", to: "a@b.test" } });

    expect(provider.parseWebhook(new TextEncoder().encode(soft), header(signed(soft))).permanent).toBe(false);
    expect(provider.parseWebhook(new TextEncoder().encode(hard), header(signed(hard))).permanent).toBe(true);
  });

  it("ignores an event type it does not act on", () => {
    const opened = JSON.stringify({ id: "evt_o", type: "email.opened", data: { email_id: "em_abc123" } });

    expect(provider.parseWebhook(new TextEncoder().encode(opened), header(signed(opened))).outcome).toBe("IGNORED");
  });

  it("refuses a signed body that is not JSON", () => {
    const junk = "not json";

    expect(() => provider.parseWebhook(new TextEncoder().encode(junk), header(signed(junk)))).toThrow(/not JSON/i);
  });
});
