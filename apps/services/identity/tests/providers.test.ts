import { createVerify, generateKeyPairSync } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVELOPMENT_DATA_KEY, loadIdentityConfig } from "../src/configs/index.js";
import type { IdentityStore } from "../src/interfaces/index.js";
import {
  createEmailProvider,
  createLoggingEmailProvider,
  createMessenger,
  createPushProvider,
  createSmsProvider,
  toInternationalNumber,
} from "../src/services/delivery/index.js";
import { createDocumentStorage, matchesFileSignature } from "../src/services/kyc/index.js";
import { createBreachChecker } from "../src/services/security/index.js";
import { createDataProtector, describeClient } from "../src/utils/index.js";
import { PRODUCTION_REQUIREMENTS } from "./harness.js";

const DATABASE = { IDENTITY_DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=identity" };
const PRODUCTION = { ...DATABASE, ...PRODUCTION_REQUIREMENTS, NODE_ENV: "production" };

function recordingLogger(): { logger: Logger; lines: unknown[] } {
  const lines: unknown[] = [];
  const logger = {
    debug: (...args: unknown[]) => lines.push(args),
    info: (...args: unknown[]) => lines.push(args),
    warn: (...args: unknown[]) => lines.push(args),
    error: (...args: unknown[]) => lines.push(args),
  } as unknown as Logger;

  return { logger, lines };
}

interface Captured {
  readonly url: string;
  readonly init: RequestInit;
}

function stubFetch(answer: (url: string, init: RequestInit) => Response): Captured[] {
  const calls: Captured[] = [];

  vi.stubGlobal("fetch", async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });

    return answer(String(url), init);
  });

  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("provider selection", () => {
  it("defaults to development adapters outside production", async () => {
    const config = await loadIdentityConfig({ ...DATABASE, NODE_ENV: "development" });

    expect(config.delivery.email).toBe("log");
    expect(config.delivery.sms.provider).toBe("none");
    expect(config.kyc.identityProvider).toBe("sandbox");
    expect(config.kyc.storage).toBeUndefined();
    expect(config.dataKey.equals(DEVELOPMENT_DATA_KEY)).toBe(true);
    expect(config.security.adminTotpRequired).toBe(false);
  });

  it("starts in production only with real providers, and requires admin TOTP there by default", async () => {
    const config = await loadIdentityConfig(PRODUCTION);

    expect(config.delivery.email).toBe("service");
    expect(config.kyc.identityProvider).toBe("unconfigured");
    expect(config.security.adminTotpRequired).toBe(true);
  });

  it.each([
    [{ EMAIL_PROVIDER: "log" }, /EMAIL_PROVIDER=log/u],
    [{ SMS_PROVIDER: "log" }, /SMS_PROVIDER=log/u],
    [{ PUSH_PROVIDER: "log" }, /PUSH_PROVIDER=log/u],
    [{ KYC_IDENTITY_PROVIDER: "sandbox" }, /sandbox/u],
    [{ IDENTITY_DATA_KEY: DEVELOPMENT_DATA_KEY.toString("base64") }, /development key/u],
    [{ IDENTITY_DATA_KEY: "" }, /IDENTITY_DATA_KEY is required/u],
    [{ REDIS_URL: "" }, /REDIS_URL/u],
    [{ SMS_PROVIDER: "termii" }, /TERMII_API_KEY/u],
    [{ PUSH_PROVIDER: "fcm" }, /FCM_PROJECT_ID/u],
    [{ KYC_STORAGE_BUCKET: "betng-kyc" }, /KYC_STORAGE_ENDPOINT/u],
    [{ KYC_STORAGE_ENDPOINT: "http://storage.example.com" }, /KYC_STORAGE_ENDPOINT/u],
  ])("refuses %o in production", async (override, problem) => {
    await expect(loadIdentityConfig({ ...PRODUCTION, ...override })).rejects.toThrow(problem);
  });
});

describe("S3 SigV4 (AWS documentation vectors)", () => {
  const storage = createDocumentStorage({
    endpoint: "https://s3.amazonaws.com",
    region: "us-east-1",
    bucket: "examplebucket",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    forcePathStyle: false,
  });

  it("presigns the documented GET example", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2013-05-24T00:00:00Z"));

    const { url } = storage.presignGet("test.txt", 86400);

    expect(url).toBe(
      "https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
    );
  });

  it("signs the documented ranged GET example in the Authorization header", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2013-05-24T00:00:00Z"));

    const calls = stubFetch(() => new Response("0123456789", { status: 206 }));

    await storage.readPrefix("test.txt", 10);

    const headers = calls[0]?.init.headers as Record<string, string>;

    expect(calls[0]?.url).toBe("https://examplebucket.s3.amazonaws.com/test.txt");
    expect(headers["authorization"]).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("binds content type and length into an upload URL", () => {
    const ticket = storage.presignPut("kyc/a/b", "image/png", 1234, 300);
    const url = new URL(ticket.url);

    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(ticket.headers).toEqual({ "Content-Type": "image/png" });
    expect(storage.presignPut("kyc/a/b", "image/png", 1235, 300).url).not.toBe(ticket.url);
  });

  it("checks file signatures", () => {
    expect(matchesFileSignature("application/pdf", Buffer.from("%PDF-1.7"))).toBe(true);
    expect(matchesFileSignature("image/jpeg", Buffer.from("%PDF-1.7"))).toBe(false);
    expect(matchesFileSignature("text/html", Buffer.from("<html>"))).toBe(false);
  });
});

describe("delivery providers", () => {
  it("asks the email service for a template and never carries the code into a failure", async () => {
    const endpoint = { name: "email" as const, url: "http://email.internal:3012", timeoutMs: 1000 };
    const calls = stubFetch((_url, init: RequestInit) =>
      Response.json({
        id: (JSON.parse(String(init?.body as string)) as { id: string }).id,
        success: true,
        result: { id: "em_1", duplicate: false },
      }),
    );
    const email = createEmailProvider(endpoint);

    await email.send({
      to: "ada@example.test",
      template: "verification_code",
      variables: { code: "482913", expiresInMinutes: "15" },
      idempotencyKey: "code-abcdef0123456789",
    });

    const body = JSON.parse(String(calls[0]?.init.body as string)) as { procedure: string; payload: Record<string, unknown> };

    expect(calls[0]?.url).toBe("http://email.internal:3012/rpc");
    expect(body.procedure).toBe("email.send");
    expect(body.payload).toMatchObject({ to: "ada@example.test", template: "verification_code", idempotencyKey: "code-abcdef0123456789" });

    stubFetch(() => new Response("rejected: the code 482913 for ada@example.test", { status: 500 }));

    const failure = await email
      .send({ to: "ada@example.test", template: "verification_code", variables: { code: "482913" }, idempotencyKey: "code-abcdef0123456789" })
      .catch((error: unknown) => error as Error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain("482913");
    expect((failure as Error).message).not.toContain("ada@example.test");

    await email.close();
  });

  it("sends Termii SMS to the dashboard base URL", async () => {
    const calls = stubFetch(() => Response.json({ message_id: "1", message: "Successfully Sent" }));
    const { logger } = recordingLogger();
    const sms = createSmsProvider({ provider: "termii", apiKey: "TL-key", senderId: "BetNG", baseUrl: "https://v3.api.termii.com", channel: "dnd" }, 1000, logger);

    await sms?.send({ to: "2348035550142", text: "hello" });

    expect(calls[0]?.url).toBe("https://v3.api.termii.com/api/sms/send");
    expect(JSON.parse(String(calls[0]?.init.body as string))).toMatchObject({ api_key: "TL-key", to: "2348035550142", from: "BetNG", sms: "hello", type: "plain", channel: "dnd" });
    expect(toInternationalNumber("+234 803 555 0142")).toBe("2348035550142");
    expect(toInternationalNumber("08035550142")).toBe("2348035550142");
    expect(toInternationalNumber("+44 20 7946 0000")).toBeUndefined();
  });

  it("signs the FCM service-account assertion with RS256, caches the token and reports unregistered devices", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    let sends = 0;

    const calls = stubFetch((url) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({ access_token: "ya29.token", expires_in: 3600 });
      }

      sends += 1;

      return sends === 2 ? Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 }) : Response.json({ name: "projects/p/messages/1" });
    });

    const { logger } = recordingLogger();
    const push = createPushProvider({ provider: "fcm", projectId: "betng-test", clientEmail: "svc@betng-test.iam.gserviceaccount.com", privateKey: pem }, 1000, logger);
    const message = { token: "device-token", title: "Bet settled", body: "You won", data: { kind: "BET_SETTLED" } };

    expect(await push?.send(message)).toBe("delivered");
    expect(await push?.send(message)).toBe("unregistered");

    const tokenCalls = calls.filter((call) => call.url === "https://oauth2.googleapis.com/token");

    expect(tokenCalls).toHaveLength(1);

    const assertion = new URLSearchParams(String(tokenCalls[0]?.init.body as string)).get("assertion") ?? "";
    const [header, claims, signature] = assertion.split(".");
    const verified = createVerify("RSA-SHA256").update(`${header ?? ""}.${claims ?? ""}`).verify(publicKey, Buffer.from(signature ?? "", "base64url"));

    expect(verified).toBe(true);
    expect(JSON.parse(Buffer.from(claims ?? "", "base64url").toString())).toMatchObject({
      iss: "svc@betng-test.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
    });

    const send = calls.find((call) => call.url.includes("fcm.googleapis.com"));

    expect(send?.url).toBe("https://fcm.googleapis.com/v1/projects/betng-test/messages:send");
    expect((send?.init.headers as Record<string, string>)["authorization"]).toBe("Bearer ya29.token");
  });

  it("never lets the log adapter print a code", async () => {
    const { logger, lines } = recordingLogger();
    const messenger = createMessenger({
      providers: { email: createLoggingEmailProvider(logger), sms: undefined, push: undefined },
      store: {} as IdentityStore,
      protector: createDataProtector(DEVELOPMENT_DATA_KEY),
      logger,
    });

    await messenger.sendCode("ada@example.test", "password_reset", "482913", new Date(Date.now() + 600_000));

    expect(JSON.stringify(lines)).not.toContain("482913");
    expect(JSON.stringify(lines)).not.toContain("ada@example.test");
  });
});

describe("password breach check", () => {
  it("sends only a five-character hash prefix and matches the suffix", async () => {
    const calls = stubFetch(() => new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:3\r\n0000000000000000000000000000000000A:0"));
    const { logger } = recordingLogger();
    const checker = createBreachChecker(true, logger);

    expect(await checker.isBreached("password")).toBe(true);
    expect(calls[0]?.url).toBe("https://api.pwnedpasswords.com/range/5BAA6");
    expect(await checker.isBreached("a-much-less-common-passphrase")).toBe(false);
  });

  it("fails open with a warning when the service cannot be reached, and is off unless enabled", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const { logger, lines } = recordingLogger();

    expect(await createBreachChecker(true, logger).isBreached("password")).toBe(false);
    expect(JSON.stringify(lines)).toContain("password_breach_check_unavailable");
    expect(JSON.stringify(lines)).not.toContain("password\"");
    expect(await createBreachChecker(false, logger).isBreached("password")).toBe(false);
  });
});

describe("data protection and client labels", () => {
  it("binds ciphertext to its context", () => {
    const protector = createDataProtector(Buffer.alloc(32, 1));
    const sealed = protector.encrypt("JBSWY3DPEHPK3PXP", "totp:a");

    expect(protector.decrypt(sealed, "totp:a")).toBe("JBSWY3DPEHPK3PXP");
    expect(() => protector.decrypt(sealed, "totp:b")).toThrow();
    expect(protector.digest("x", "1")).not.toBe(protector.digest("y", "1"));
  });

  it("labels common browsers without guessing a location", () => {
    expect(describeClient("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15")).toEqual({
      device: "Computer",
      browser: "Safari 17",
      platform: "macOS",
    });
    expect(describeClient("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36")).toEqual({
      device: "Phone",
      browser: "Chrome 128",
      platform: "Android",
    });
    expect(describeClient(undefined)).toEqual({ device: undefined, browser: undefined, platform: undefined });
  });
});
