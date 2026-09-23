import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, WebhookSignatureError } from "../src/index.js";

const NOW = 1_800_000_000;
const SECRET = "whsec_0123456789abcdef0123456789abcdef";
const OTHER = "whsec_fedcba9876543210fedcba9876543210";
const BODY = Buffer.from('{"id":"evt_1","type":"collection.succeeded"}', "utf8");

const sign = (secret: string, timestamp: number, body: Uint8Array = BODY): string => {
  const signed = Buffer.concat([Buffer.from(`${String(timestamp)}.`, "utf8"), Buffer.from(body)]);

  return `t=${String(timestamp)},v1=${createHmac("sha256", secret).update(signed).digest("hex")}`;
};

const verify = (header: string | undefined, secrets: readonly string[] = [SECRET], now = NOW): void => {
  verifyWebhookSignature({ body: BODY, header, secrets, now });
};

const reasonOf = (call: () => void): string => {
  try {
    call();
  } catch (error) {
    return error instanceof WebhookSignatureError ? error.reason : "NOT_A_SIGNATURE_ERROR";
  }

  return "NO_ERROR";
};

describe("webhook signature", () => {
  it("accepts a signature made over the raw body", () => {
    expect(() => verify(sign(SECRET, NOW))).not.toThrow();
  });

  it("accepts either secret during a rotation window", () => {
    expect(() => verify(sign(OTHER, NOW), [SECRET, OTHER])).not.toThrow();
    expect(() => verify(sign(SECRET, NOW), [SECRET, OTHER])).not.toThrow();
  });

  it("refuses a body changed by one byte", () => {
    const header = sign(SECRET, NOW);
    const tampered = Buffer.from('{"id":"evt_2","type":"collection.succeeded"}', "utf8");

    expect(reasonOf(() => { verifyWebhookSignature({ body: tampered, header, secrets: [SECRET], now: NOW }); })).toBe("MISMATCH");
  });

  it("refuses a body that was re-serialised rather than passed through", () => {
    const header = sign(SECRET, NOW);
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(BODY.toString("utf8")), null, 2), "utf8");

    expect(reasonOf(() => { verifyWebhookSignature({ body: reserialised, header, secrets: [SECRET], now: NOW }); })).toBe("MISMATCH");
  });

  it("refuses a signature made with an unknown secret", () => {
    expect(reasonOf(() => { verify(sign(OTHER, NOW)); })).toBe("MISMATCH");
  });

  it("refuses a replay outside the tolerance, in either direction", () => {
    expect(reasonOf(() => { verify(sign(SECRET, NOW - 301)); })).toBe("STALE");
    expect(reasonOf(() => { verify(sign(SECRET, NOW + 301)); })).toBe("STALE");
    expect(() => verify(sign(SECRET, NOW - 299))).not.toThrow();
  });

  it.each([undefined, "", "v1=abc", "t=,v1=abc", `t=${String(NOW)},v1=nothex`, `t=${String(NOW)}`])(
    "refuses the header %o",
    (header) => {
      expect(["MISSING", "MALFORMED"]).toContain(reasonOf(() => { verify(header); }));
    },
  );

  it("refuses an empty secret list, and ignores a blank secret", () => {
    expect(reasonOf(() => { verify(sign(SECRET, NOW), []); })).toBe("MISMATCH");
    expect(() => verify(sign(SECRET, NOW), ["", SECRET])).not.toThrow();
  });
});
