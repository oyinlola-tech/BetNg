// RFC 6238 TOTP on node:crypto: @zudojs/crypto has no TOTP and refuses SHA-1, which authenticator apps use.

import { createHmac, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;

const CODE_PATTERN = /^\d{6}$/u;

export function decodeBase32(value: string): Buffer {
  const clean = value.replace(/=+$/u, "").replace(/\s+/gu, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index === -1) {
      throw new Error("The secret is not valid base32.");
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

export function encodeBase32(bytes: Uint8Array): string {
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET.charAt((buffer >>> bits) & 31);
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 31);
  }

  return output;
}

export function totpStep(atMs: number): number {
  return Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
}

export function hotp(key: Uint8Array, counter: number, digits: number = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", key).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function generateTotp(secretBase32: string, atMs: number): string {
  return hotp(decodeBase32(secretBase32), totpStep(atMs));
}

export interface TotpCheck {
  readonly secretBase32: string;
  readonly code: string;
  readonly atMs: number;
  readonly lastUsedStep: number | undefined;
}

/** Every candidate step is compared in constant time. The caller must persist the returned step before granting a session; that makes a code single-use. */
export function verifyTotp(check: TotpCheck): number | undefined {
  if (!CODE_PATTERN.test(check.code)) {
    return undefined;
  }

  const key = decodeBase32(check.secretBase32);
  const current = totpStep(check.atMs);
  const submitted = Buffer.from(check.code, "ascii");
  let matched: number | undefined;

  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step += 1) {
    const expected = Buffer.from(hotp(key, step));
    const equal = timingSafeEqual(expected, submitted);
    const fresh = check.lastUsedStep === undefined || step > check.lastUsedStep;

    if (equal && fresh && matched === undefined) {
      matched = step;
    }
  }

  return matched;
}

/**
 * The `otpauth://` URI an authenticator scans. Built in one place so the CLI, the create route and the
 * credential reset all label an account the same way.
 */
export function otpauthUri(email: string, secretBase32: string, issuer = "BetNG Admin"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const query = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
}
