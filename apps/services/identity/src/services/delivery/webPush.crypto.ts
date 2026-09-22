import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";
import type { ECDH, KeyObject } from "node:crypto";

export const RECORD_SIZE = 4096;
const TAG_BYTES = 16;
const HEADER_BYTES = 16 + 4 + 1 + 65;
export const MAX_PLAINTEXT_BYTES = RECORD_SIZE - TAG_BYTES - 1;
export const JWT_LIFETIME_S = 12 * 3600;

const P256_PUBLIC_BYTES = 65;
const P256_PRIVATE_BYTES = 32;
const AUTH_SECRET_BYTES = 16;

const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
] as const;

export interface WebPushSubscription {
  readonly endpoint: string;
  readonly p256dh: Buffer;
  readonly auth: Buffer;
}

export interface VapidKeys {
  readonly publicKey: Buffer;
  readonly privateKey: Buffer;
  readonly subject: string;
}

const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export function decodeBase64url(value: unknown, bytes: number): Buffer | undefined {
  if (typeof value !== "string" || !BASE64URL.test(value) || value.length > 200) {
    return undefined;
  }

  const decoded = Buffer.from(value, "base64url");

  return decoded.length === bytes ? decoded : undefined;
}

const isUncompressedPoint = (key: Buffer): boolean => key.length === P256_PUBLIC_BYTES && key[0] === 0x04;

function allowedPushHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  return ALLOWED_PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** An https endpoint on a known browser push service, default port, no credentials: anything else could aim the server at internal hosts. */
export function parseEndpoint(value: unknown): URL | undefined {
  if (typeof value !== "string" || value.length > 1024) {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "" || url.hash !== "") {
    return undefined;
  }

  return allowedPushHost(url.hostname) ? url : undefined;
}

/** The JSON of a browser PushSubscription: {endpoint, expirationTime?, keys: {p256dh, auth}}, nothing else. */
export function parseSubscription(token: string): WebPushSubscription | undefined {
  let value: unknown;

  try {
    value = JSON.parse(token);
  } catch {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  if (Object.keys(record).some((key) => key !== "endpoint" && key !== "expirationTime" && key !== "keys")) {
    return undefined;
  }

  if (record["expirationTime"] !== undefined && record["expirationTime"] !== null && typeof record["expirationTime"] !== "number") {
    return undefined;
  }

  const keys = record["keys"];

  if (typeof keys !== "object" || keys === null || Array.isArray(keys)) {
    return undefined;
  }

  const keyRecord = keys as Record<string, unknown>;

  if (Object.keys(keyRecord).some((key) => key !== "p256dh" && key !== "auth")) {
    return undefined;
  }

  const endpoint = parseEndpoint(record["endpoint"]);
  const p256dh = decodeBase64url(keyRecord["p256dh"], P256_PUBLIC_BYTES);
  const auth = decodeBase64url(keyRecord["auth"], AUTH_SECRET_BYTES);

  if (endpoint === undefined || p256dh === undefined || auth === undefined || !isUncompressedPoint(p256dh)) {
    return undefined;
  }

  return { endpoint: endpoint.href, p256dh, auth };
}

/** Undefined when the keys are malformed or are not one pair. */
export function readVapidKeys(publicKey: string, privateKey: string, subject: string): VapidKeys | undefined {
  const pub = decodeBase64url(publicKey, P256_PUBLIC_BYTES);
  const priv = decodeBase64url(privateKey, P256_PRIVATE_BYTES);

  if (pub === undefined || priv === undefined || !isUncompressedPoint(pub)) {
    return undefined;
  }

  try {
    const ecdh = createECDH("prime256v1");

    ecdh.setPrivateKey(priv);

    return ecdh.getPublicKey().equals(pub) ? { publicKey: pub, privateKey: priv, subject } : undefined;
  } catch {
    return undefined;
  }
}

export function vapidSigningKey(keys: VapidKeys): KeyObject {
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: keys.privateKey.toString("base64url"),
      x: keys.publicKey.subarray(1, 33).toString("base64url"),
      y: keys.publicKey.subarray(33, 65).toString("base64url"),
    },
  });
}

/** RFC 8292: an ES256 JWT for the push service's origin. */
export function vapidAuthorization(keys: VapidKeys, signingKey: KeyObject, endpoint: string, nowS: number): string {
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowS + JWT_LIFETIME_S, sub: keys.subject })).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key: signingKey, dsaEncoding: "ieee-p1363" });

  return `vapid t=${header}.${claims}.${signature.toString("base64url")}, k=${keys.publicKey.toString("base64url")}`;
}

export interface EncryptionSeed {
  readonly ephemeral?: ECDH;
  readonly salt?: Buffer;
}

/** RFC 8291 / RFC 8188 aes128gcm, one record. */
export function encryptPayload(subscription: WebPushSubscription, plaintext: Buffer, seed: EncryptionSeed = {}): Buffer {
  if (plaintext.length > MAX_PLAINTEXT_BYTES) {
    throw new RangeError("The push payload is too large.");
  }

  const ephemeral = seed.ephemeral ?? createECDH("prime256v1");

  if (seed.ephemeral === undefined) {
    ephemeral.generateKeys();
  }

  const salt = seed.salt ?? randomBytes(16);
  const serverPublic = ephemeral.getPublicKey();
  const sharedSecret = ephemeral.computeSecret(subscription.p256dh);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), subscription.p256dh, serverPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", sharedSecret, subscription.auth, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([0x02])])), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(HEADER_BYTES);

  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverPublic.length, 20);
  serverPublic.copy(header, 21);

  return Buffer.concat([header, body]);
}
