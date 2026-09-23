import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadPaymentSettings, loadWalletSettings, Secret } from "../src/configs/index.js";
import { createFlutterwaveProvider, createPaystackProvider, nairaToKobo, WebhookRejectedError } from "../src/providers/index.js";
import { createFieldCipher, hmacSha512Hex } from "../src/security/crypto.js";
import { renderCsv, renderPdf } from "../src/statements/statement.render.js";
import { createS3Storage } from "../src/storage/s3.storage.js";

const LIVE_PAYSTACK = `sk_live_${"x9y8z7w6".repeat(5)}`;
const TEST_PAYSTACK = `sk_test_${"x9y8z7w6".repeat(5)}`;
const KEY = randomBytes(32).toString("base64");

const production = {
  NODE_ENV: "production",
  PAYMENTS_PROVIDER: "paystack",
  PAYSTACK_SECRET_KEY: LIVE_PAYSTACK,
  PAYMENTS_CALLBACK_BASE_URL: "https://betng.example",
  WALLET_ENCRYPTION_KEY: KEY,
};

describe("payment configuration", () => {
  it("accepts a complete production configuration and never prints its secrets", () => {
    const settings = loadPaymentSettings(production);
    const printed = JSON.stringify(settings);

    expect(settings.activeProvider).toBe("PAYSTACK");
    expect(settings.simulatedFundsEnabled).toBe(false);
    expect(printed).not.toContain(LIVE_PAYSTACK);
    expect(printed).not.toContain(KEY);
    expect(String(settings.paystack?.secretKey)).toBe("[redacted]");
  });

  it.each([
    ["the sandbox", { ...production, PAYMENTS_PROVIDER: "sandbox" }],
    ["Bachs, which has no configured API", { ...production, PAYMENTS_PROVIDER: "bachs" }],
    ["a test key", { ...production, PAYSTACK_SECRET_KEY: TEST_PAYSTACK }],
    ["a missing encryption key", { ...production, WALLET_ENCRYPTION_KEY: "" }],
    ["an http callback", { ...production, PAYMENTS_CALLBACK_BASE_URL: "http://betng.example" }],
    ["an http provider URL", { ...production, PAYSTACK_BASE_URL: "http://127.0.0.1:9000" }],
    ["no provider choice", { ...production, PAYMENTS_PROVIDER: "" }],
    ["the play-money routes", { ...production, WALLET_SIMULATED_FUNDS: "true" }],
    ["half a storage configuration", { ...production, WALLET_STORAGE_BUCKET: "statements" }],
    ["a Flutterwave key without its webhook hash", { ...production, FLUTTERWAVE_SECRET_KEY: "FLWSECK-abcdefghijklmnop1234-X" }],
  ])("refuses to start in production with %s", (_label, env) => {
    expect(() => loadPaymentSettings(env)).toThrow();
  });

  it("refuses a welcome grant once wallets hold real money", () => {
    expect(loadWalletSettings(production).welcomeGrantKobo).toBe(0n);
    expect(() => loadWalletSettings({ ...production, WELCOME_GRANT_KOBO: "1000" })).toThrow();
  });
});

describe("field encryption", () => {
  it("round-trips, binds the ciphertext to its owner and never repeats a ciphertext", () => {
    const cipher = createFieldCipher({ version: 1, secret: new Secret(KEY) });
    const first = cipher.encrypt("0123456789", "user-a");
    const second = cipher.encrypt("0123456789", "user-a");

    expect(first).not.toContain("0123456789");
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first, "user-a")).toBe("0123456789");
    expect(() => cipher.decrypt(first, "user-b")).toThrow();
    expect(cipher.lookupHash("058:0123456789")).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("opens a retired key's rows while writing every new one under the active key", () => {
    const retiredKey = new Secret(randomBytes(32).toString("base64"));
    const before = createFieldCipher({ version: 1, secret: retiredKey });
    const written = before.encrypt("0123456789", "user-a");

    expect(written.startsWith("v1:")).toBe(true);

    const after = createFieldCipher({ version: 2, secret: new Secret(KEY) }, [{ version: 1, secret: retiredKey }]);

    expect(after.activeVersion).toBe(2);
    expect(after.decrypt(written, "user-a")).toBe("0123456789");
    expect(after.encrypt("0123456789", "user-a").startsWith("v2:")).toBe(true);
    expect(after.decrypt(after.encrypt("55", "user-a"), "user-a")).toBe("55");
  });

  it("refuses a ciphertext whose key the ring no longer holds rather than reading it wrong", () => {
    const retiredKey = new Secret(randomBytes(32).toString("base64"));
    const written = createFieldCipher({ version: 1, secret: retiredKey }).encrypt("0123456789", "user-a");
    const withoutIt = createFieldCipher({ version: 2, secret: new Secret(KEY) });

    expect(() => withoutIt.decrypt(written, "user-a")).toThrow(/no longer holds/iu);
  });

  it("refuses a retired key list that collides with the active version or repeats one", () => {
    const retired = randomBytes(32).toString("base64");

    expect(() =>
      loadPaymentSettings({ ...production, WALLET_ENCRYPTION_KEY_VERSION: "2", WALLET_ENCRYPTION_KEYS_RETIRED: `2:${retired}` }),
    ).toThrow();
    expect(() =>
      loadPaymentSettings({
        ...production,
        WALLET_ENCRYPTION_KEY_VERSION: "3",
        WALLET_ENCRYPTION_KEYS_RETIRED: `1:${retired},1:${retired}`,
      }),
    ).toThrow();
    expect(
      loadPaymentSettings({ ...production, WALLET_ENCRYPTION_KEY_VERSION: "2", WALLET_ENCRYPTION_KEYS_RETIRED: `1:${retired}` })
        .retiredEncryptionKeys,
    ).toHaveLength(1);
  });
});

describe("provider webhooks", () => {
  const paystack = createPaystackProvider({ secretKey: new Secret(TEST_PAYSTACK), baseUrl: "https://api.paystack.co" }, 1000);

  it("verifies the Paystack HMAC over the exact bytes", () => {
    const body = Buffer.from(JSON.stringify({ event: "charge.success", data: { id: 7, reference: "bngd-1", amount: 5000, currency: "NGN" } }));
    const signature = hmacSha512Hex(TEST_PAYSTACK, body);
    const event = paystack.parseWebhook(body, (name) => (name === "x-paystack-signature" ? signature : undefined));
    const tampered = Buffer.from(body.toString("utf8").replace("5000", "9000"));

    expect(event).toMatchObject({ eventId: "charge.success:7", subject: "DEPOSIT", reference: "bngd-1", amount: 5000 });
    expect(() => paystack.parseWebhook(tampered, () => signature)).toThrow(WebhookRejectedError);
  });

  it("checks the Flutterwave verif-hash and converts naira exactly", () => {
    const flutterwave = createFlutterwaveProvider(
      { secretKey: new Secret("FLWSECK_TEST-abcdefghijklmnop-X"), webhookHash: new Secret("a-long-webhook-hash-value"), baseUrl: "https://api.flutterwave.com" },
      1000,
    );
    const body = Buffer.from(JSON.stringify({ event: "charge.completed", data: { id: 9, tx_ref: "bngd-2", amount: 1500.5, currency: "NGN", status: "successful" } }));

    expect(flutterwave.parseWebhook(body, () => "a-long-webhook-hash-value")).toMatchObject({ reference: "bngd-2", amount: 150_050, subject: "DEPOSIT" });
    expect(() => flutterwave.parseWebhook(body, () => "wrong")).toThrow(WebhookRejectedError);
    expect(nairaToKobo("1500.50")).toBe(150_050);
    expect(nairaToKobo(0.1)).toBe(10);
    expect(nairaToKobo("1.005")).toBeUndefined();
  });
});

describe("statement storage", () => {
  it("signs a presigned GET exactly as the AWS SigV4 reference example", () => {
    const storage = createS3Storage({
      endpoint: "https://s3.amazonaws.com",
      region: "us-east-1",
      bucket: "examplebucket",
      accessKeyId: new Secret("AKIAIOSFODNN7EXAMPLE"),
      secretAccessKey: new Secret("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"),
      forcePathStyle: false,
    });
    const url = storage.presignGet("test.txt", 86_400, { now: new Date("2013-05-24T00:00:00Z") });

    expect(url.startsWith("https://examplebucket.s3.amazonaws.com/test.txt?")).toBe(true);
    expect(url).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });
});

describe("statement files", () => {
  const document = {
    holder: "Ada (Obi)",
    from: "2026-09-01",
    to: "2026-09-21",
    generatedAt: new Date("2026-09-21T12:00:00Z"),
    openingBalance: 100_000n,
    truncated: false,
    lines: Array.from({ length: 150 }, (_, index) => ({
      createdAt: new Date(Date.UTC(2026, 8, 2, 0, index)),
      type: index % 2 === 0 ? ("DEPOSIT" as const) : ("BET_STAKE" as const),
      amount: index % 2 === 0 ? 5_000n : -2_500n,
      balanceAfter: 100_000n + BigInt(Math.ceil((index + 1) / 2)) * 5_000n - BigInt(Math.floor((index + 1) / 2)) * 2_500n,
      reference: index === 0 ? "=HYPERLINK(\"http://x\")" : `ref-${String(index)}`,
      note: null,
    })),
  };

  it("writes a PDF 1.4 whose xref offsets point at their objects", () => {
    const pdf = Buffer.from(renderPdf(document)).toString("latin1");
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/u.exec(pdf)?.[1]);
    const entries = pdf.slice(startxref).split("\n").slice(2).filter((line) => / 00000 n $/u.test(line));

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
    expect(entries.length).toBeGreaterThan(4);
    entries.forEach((line, index) => {
      expect(pdf.slice(Number(line.slice(0, 10)), Number(line.slice(0, 10)) + 12)).toContain(`${String(index + 1)} 0 obj`);
    });
    expect(pdf).toContain("/Count 3");
    expect(pdf).toContain("Ada \\(Obi\\)");
  });

  it("writes CSV in integer-exact naira and defuses formula cells", () => {
    const csv = Buffer.from(renderCsv(document)).toString("utf8").split("\r\n");

    expect(csv[0]).toBe("Date,Type,Reference,Description,Amount (NGN),Balance (NGN)");
    expect(csv[2]).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv[3]).toContain(",-25.00,");
  });
});
