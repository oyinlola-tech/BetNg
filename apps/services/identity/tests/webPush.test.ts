import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEVELOPMENT_DATA_KEY, loadIdentityConfig } from "../src/configs/index.js";
import type { IdentityStore } from "../src/interfaces/index.js";
import { createEmailProvider, createMessenger, createWebPushProvider, parseSubscription } from "../src/services/delivery/index.js";
import { encryptPayload, readVapidKeys, vapidAuthorization, vapidSigningKey } from "../src/services/delivery/webPush.crypto.js";
import { webPushNotice } from "../src/services/delivery/webPush.provider.js";
import { createDataProtector } from "../src/utils/index.js";
import { registerPushDeviceValidator } from "../src/validators/index.js";
import { PRODUCTION_REQUIREMENTS } from "./harness.js";

const b64 = (value: string): Buffer => Buffer.from(value, "base64url");

const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  message:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

function vapidPair(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH("prime256v1");

  ecdh.generateKeys();

  const privateKey = ecdh.getPrivateKey();

  return {
    publicKey: ecdh.getPublicKey().toString("base64url"),
    privateKey: Buffer.concat([Buffer.alloc(32 - privateKey.length), privateKey]).toString("base64url"),
  };
}

function subscriptionJson(endpoint = ENDPOINT): string {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: RFC.uaPublic, auth: RFC.auth } });
}

function decrypt(message: Buffer, uaPrivate: string, auth: Buffer): string {
  const salt = message.subarray(0, 16);
  const idLength = message.readUInt8(20);
  const serverPublic = message.subarray(21, 21 + idLength);
  const ua = createECDH("prime256v1");

  ua.setPrivateKey(b64(uaPrivate));

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", ua.computeSecret(serverPublic), auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const body = message.subarray(21 + idLength);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);

  decipher.setAuthTag(body.subarray(body.length - 16));

  const padded = Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]);

  expect(padded[padded.length - 1]).toBe(0x02);

  return padded.subarray(0, padded.length - 1).toString("utf8");
}

const silentLogger = (): { logger: Logger; lines: unknown[] } => {
  const lines: unknown[] = [];
  const record = (...args: unknown[]): number => lines.push(args);

  return { logger: { debug: record, info: record, warn: record, error: record } as unknown as Logger, lines };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RFC 8291 payload encryption", () => {
  it("reproduces the RFC 8291 section 5 message", () => {
    const ephemeral = createECDH("prime256v1");

    ephemeral.setPrivateKey(b64(RFC.asPrivate));
    expect(ephemeral.getPublicKey().toString("base64url")).toBe(RFC.asPublic);

    const encrypted = encryptPayload({ endpoint: ENDPOINT, p256dh: b64(RFC.uaPublic), auth: b64(RFC.auth) }, Buffer.from(RFC.plaintext), {
      ephemeral,
      salt: b64(RFC.salt),
    });

    expect(encrypted.toString("base64url")).toBe(RFC.message);
  });

  it("uses a fresh key and salt per message that the browser can decrypt", () => {
    const subscription = { endpoint: ENDPOINT, p256dh: b64(RFC.uaPublic), auth: b64(RFC.auth) };
    const first = encryptPayload(subscription, Buffer.from("hello"));
    const second = encryptPayload(subscription, Buffer.from("hello"));

    expect(first.readUInt32BE(16)).toBe(4096);
    expect(first.subarray(0, 16).equals(second.subarray(0, 16))).toBe(false);
    expect(decrypt(first, RFC.uaPrivate, b64(RFC.auth))).toBe("hello");
    expect(() => encryptPayload(subscription, Buffer.alloc(4080))).toThrow(RangeError);
  });
});

describe("VAPID", () => {
  it("signs an ES256 JWT for the endpoint origin that verifies with the public key", () => {
    const pair = vapidPair();
    const keys = readVapidKeys(pair.publicKey, pair.privateKey, "mailto:ops@betng.example");

    expect(keys).toBeDefined();
    if (keys === undefined) return;

    const nowS = 1_800_000_000;
    const header = vapidAuthorization(keys, vapidSigningKey(keys), ENDPOINT, nowS);
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=([A-Za-z0-9_-]+)$/u.exec(header);

    expect(match).not.toBeNull();
    const [, head = "", claims = "", signature = "", k = ""] = match ?? [];

    expect(k).toBe(pair.publicKey);
    expect(JSON.parse(b64(head).toString())).toEqual({ typ: "JWT", alg: "ES256" });

    const body = JSON.parse(b64(claims).toString()) as { aud: string; exp: number; sub: string };

    expect(body.aud).toBe("https://fcm.googleapis.com");
    expect(body.sub).toBe("mailto:ops@betng.example");
    expect(body.exp - nowS).toBeGreaterThan(0);
    expect(body.exp - nowS).toBeLessThanOrEqual(86_400);

    const raw = b64(pair.publicKey);
    const publicKey = createPublicKey({
      format: "jwk",
      key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") },
    });

    expect(b64(signature)).toHaveLength(64);
    expect(verify("sha256", Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, b64(signature))).toBe(true);
    expect(verify("sha256", Buffer.from(`${head}.${claims}x`), { key: publicKey, dsaEncoding: "ieee-p1363" }, b64(signature))).toBe(false);
  });

  it("refuses keys that are malformed or not one pair", () => {
    const a = vapidPair();
    const b = vapidPair();

    expect(readVapidKeys(a.publicKey, b.privateKey, "mailto:a@b.c")).toBeUndefined();
    expect(readVapidKeys(a.publicKey.slice(2), a.privateKey, "mailto:a@b.c")).toBeUndefined();
    expect(readVapidKeys(a.publicKey, "not base64url!", "mailto:a@b.c")).toBeUndefined();
  });
});

describe("web push configuration", () => {
  const DATABASE = { IDENTITY_DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=identity" };

  it("is off when unset and loads a matching pair", async () => {
    expect((await loadIdentityConfig({ ...DATABASE, NODE_ENV: "development" })).delivery.webPush).toBeUndefined();

    const pair = vapidPair();
    const config = await loadIdentityConfig({
      ...DATABASE,
      ...PRODUCTION_REQUIREMENTS,
      NODE_ENV: "production",
      VAPID_PUBLIC_KEY: pair.publicKey,
      VAPID_PRIVATE_KEY: pair.privateKey,
      VAPID_SUBJECT: "https://betng.example",
    });

    expect(config.delivery.webPush?.keys.publicKey.toString("base64url")).toBe(pair.publicKey);
  });

  it.each(["production", "development"])("refuses a half or mismatched configuration in %s", async (mode) => {
    const pair = vapidPair();
    const base = { ...DATABASE, ...(mode === "production" ? PRODUCTION_REQUIREMENTS : {}), NODE_ENV: mode };

    await expect(loadIdentityConfig({ ...base, VAPID_PUBLIC_KEY: pair.publicKey })).rejects.toThrow(/VAPID_PRIVATE_KEY is required/u);
    await expect(
      loadIdentityConfig({ ...base, VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: vapidPair().privateKey, VAPID_SUBJECT: "mailto:ops@betng.example" }),
    ).rejects.toThrow(/one P-256 key pair/u);
    await expect(
      loadIdentityConfig({ ...base, VAPID_PUBLIC_KEY: pair.publicKey, VAPID_PRIVATE_KEY: pair.privateKey, VAPID_SUBJECT: "http://betng.example" }),
    ).rejects.toThrow(/VAPID_SUBJECT/u);
  });

  it("never puts the private key in the error", async () => {
    const pair = vapidPair();
    const error = await loadIdentityConfig({ ...DATABASE, NODE_ENV: "development", VAPID_PUBLIC_KEY: vapidPair().publicKey, VAPID_PRIVATE_KEY: pair.privateKey, VAPID_SUBJECT: "mailto:a@b.c" }).catch(
      (caught: unknown) => caught,
    );

    expect(String(error)).not.toContain(pair.privateKey);
  });
});

describe("subscription validation", () => {
  const register = (token: string, platform = "web"): boolean => registerPushDeviceValidator.safeParse({ platform, label: "Chrome", token }).success;

  it("accepts a browser PushSubscription JSON", () => {
    expect(register(subscriptionJson())).toBe(true);
    expect(register(subscriptionJson("https://updates.push.services.mozilla.com/wpush/v2/abc"))).toBe(true);
    expect(register(subscriptionJson("https://web.push.apple.com/QGx"))).toBe(true);
    expect(parseSubscription(subscriptionJson())?.endpoint).toBe(ENDPOINT);
  });

  it.each([
    ["an http endpoint", subscriptionJson("http://fcm.googleapis.com/fcm/send/abc")],
    ["an unknown host", subscriptionJson("https://attacker.example/push")],
    ["a lookalike host", subscriptionJson("https://evilfcm.googleapis.com.attacker.example/x")],
    ["a loopback address", subscriptionJson("https://127.0.0.1/push")],
    ["an explicit port", subscriptionJson("https://fcm.googleapis.com:8443/fcm/send/abc")],
    ["credentials", subscriptionJson("https://user:pw@fcm.googleapis.com/fcm/send/abc")],
    ["a short p256dh", JSON.stringify({ endpoint: ENDPOINT, keys: { p256dh: RFC.uaPublic.slice(4), auth: RFC.auth } })],
    ["a compressed p256dh", JSON.stringify({ endpoint: ENDPOINT, keys: { p256dh: Buffer.concat([Buffer.from([2]), b64(RFC.uaPublic).subarray(1)]).toString("base64url"), auth: RFC.auth } })],
    ["a long auth", JSON.stringify({ endpoint: ENDPOINT, keys: { p256dh: RFC.uaPublic, auth: `${RFC.auth}AAAA` } })],
    ["an extra field", JSON.stringify({ endpoint: ENDPOINT, keys: { p256dh: RFC.uaPublic, auth: RFC.auth }, extra: 1 })],
    ["missing keys", JSON.stringify({ endpoint: ENDPOINT })],
    ["not JSON", "fcm-registration-token-value"],
  ])("refuses %s for platform web", (_, token) => {
    expect(register(token)).toBe(false);
  });

  it("leaves native tokens as they were", () => {
    expect(register("native-fcm-registration-token-000", "android")).toBe(true);
    expect(register("token with spaces in it", "ios")).toBe(false);
  });
});

describe("web push delivery", () => {
  function setup(status: number): { calls: { url: string; init: RequestInit }[]; removed: string[]; lines: unknown[]; send: () => Promise<void>; fcmCalls: number[] } {
    const calls: { url: string; init: RequestInit }[] = [];
    const removed: string[] = [];
    const fcmCalls: number[] = [];

    vi.stubGlobal("fetch", async (url: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });

      return new Response(null, { status });
    });

    const pair = vapidPair();
    const keys = readVapidKeys(pair.publicKey, pair.privateKey, "mailto:ops@betng.example");

    if (keys === undefined) throw new Error("keys");

    const { logger, lines } = silentLogger();
    const protector = createDataProtector(DEVELOPMENT_DATA_KEY);
    const devices = [
      { id: "11111111-1111-4111-8111-111111111111", platform: "web", tokenHash: "hash-web", tokenCiphertext: protector.encrypt(subscriptionJson(), "push:11111111-1111-4111-8111-111111111111") },
      { id: "22222222-2222-4222-8222-222222222222", platform: "android", tokenHash: "hash-android", tokenCiphertext: protector.encrypt("native-token-0000000", "push:22222222-2222-4222-8222-222222222222") },
    ];
    const store = {
      customers: { findById: async () => ({ id: "c1", email: "ada@example.test", phone: null, deletedAt: null }) },
      channels: {
        findPreferences: async () => undefined,
        listDevices: async () => devices,
        removeByTokenHash: async (hash: string) => {
          removed.push(hash);
        },
      },
    } as unknown as IdentityStore;

    const messenger = createMessenger({
      providers: {
        email: createEmailProvider({ provider: "log" }, 1000, logger),
        sms: undefined,
        push: {
          name: "fake-fcm",
          send: async () => {
            fcmCalls.push(1);

            return "delivered";
          },
        },
        webPush: createWebPushProvider({ keys }, 1000, logger),
      },
      store,
      protector,
      logger,
    });

    return { calls, removed, lines, fcmCalls, send: async () => messenger.fanOut("c1", { kind: "SECURITY_ALERT", title: "Title", body: "Body", data: {} }) };
  }

  it("posts an encrypted aes128gcm body with VAPID to the endpoint, and routes native devices to FCM", async () => {
    const { calls, removed, send, fcmCalls, lines } = setup(201);

    await send();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(ENDPOINT);

    const headers = calls[0]?.init.headers as Record<string, string>;

    expect(headers["content-encoding"]).toBe("aes128gcm");
    expect(headers["authorization"]).toMatch(/^vapid t=.+, k=/u);
    expect(headers["ttl"]).toBe("86400");
    expect(calls[0]?.init.redirect).toBe("error");

    const plaintext = decrypt(Buffer.from(calls[0]?.init.body as Uint8Array), RFC.uaPrivate, b64(RFC.auth));

    expect(JSON.parse(plaintext)).toEqual({ title: "Title", body: "Body", url: "/account/security", tag: "SECURITY_ALERT" });
    expect(fcmCalls).toHaveLength(1);
    expect(removed).toEqual([]);
    expect(JSON.stringify(lines)).not.toContain(RFC.auth);
  });

  it.each([404, 410])("removes the subscription when the push service answers %i", async (status) => {
    const { removed, send, lines } = setup(status);

    await send();

    expect(removed).toEqual(["hash-web"]);
    expect(JSON.stringify(lines)).not.toContain("/fcm/send/abc123");
    expect(JSON.stringify(lines)).not.toContain(RFC.uaPublic);
  });

  it("keeps the subscription on other failures", async () => {
    const { removed, send } = setup(500);

    await send();

    expect(removed).toEqual([]);
  });
});

describe("web push notice", () => {
  const bet = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("opens a same-origin path built only from validated identifiers and carries nothing else", () => {
    expect(webPushNotice("You won ₦1,280.00", "Your bet won.", { kind: "BET_SETTLED", betId: bet, payout: "128000", outcome: "WON" })).toEqual({
      title: "You won ₦1,280.00",
      body: "Your bet won.",
      url: `/tickets/${bet}`,
      tag: `BET_SETTLED:${bet}`,
    });
    expect(webPushNotice("t", "b", { kind: "PAYMENT_UPDATED", reference: "DEP_abc123" }).url).toBe("/payments/DEP_abc123");
    expect(webPushNotice("t", "b", { kind: "RESULT_AVAILABLE", matchId: bet }).url).toBe(`/results/${bet}`);
    expect(webPushNotice("t", "b", { kind: "LIMIT_WARNING" }).url).toBe("/responsible-gaming");
  });

  it.each([
    { kind: "BET_SETTLED", betId: "https://evil.example/x" },
    { kind: "BET_SETTLED", betId: "../../admin" },
    { kind: "PAYMENT_UPDATED", reference: "//evil.example" },
    { kind: "MATCH_STARTING", matchId: "javascript:alert(1)" },
    { kind: "UNKNOWN<script>" },
  ])("never lets data steer the target: %o", (data) => {
    const notice = webPushNotice("t", "b", data);

    expect(notice.url).toMatch(/^\/(?!\/)[A-Za-z0-9/_-]*$/u);
    expect(JSON.stringify(notice)).not.toContain("evil");
    expect(JSON.stringify(notice)).not.toContain("script");
  });
});
