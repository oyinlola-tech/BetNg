import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Secret, VersionedKey } from "../configs/index.js";

const IV_BYTES = 12;

/** Equal-length digests first, so neither the content nor the length of either side leaks through timing. */
export function constantTimeEqual(left: string | Uint8Array, right: string | Uint8Array): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();

  return timingSafeEqual(a, b);
}

export function hmacSha512Hex(secret: string, body: Uint8Array): string {
  return createHmac("sha512", secret).update(body).digest("hex");
}

export interface FieldCipher {
  encrypt(plaintext: string, context: string): string;
  decrypt(ciphertext: string, context: string): string;
  lookupHash(value: string): string;
  /** The key version new ciphertext is written under, so a re-encryption pass knows what is already current. */
  readonly activeVersion: number;
}

interface DerivedKey {
  readonly encryption: Buffer;
  readonly lookup: Buffer;
}

function derive(secret: Secret): DerivedKey {
  const master = Buffer.from(secret.reveal(), "base64");

  return {
    encryption: Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "betng-wallet/bank-account/enc", 32)),
    lookup: Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "betng-wallet/bank-account/lookup", 32)),
  };
}

/**
 * AES-256-GCM with the owner id as associated data, so a ciphertext copied to
 * another user's row does not open.
 *
 * Every ciphertext names the key that wrote it, so a retired key can still open
 * its own rows while new writes use the active one. Rotation is therefore a
 * config change plus a re-encryption pass, not a flag day: `retired` keys are
 * decrypt-only and never write. The lookup hash follows the active key, so a
 * rotation must re-hash alongside re-encrypting or lookups stop matching.
 */
export function createFieldCipher(active: VersionedKey, retired: readonly VersionedKey[] = []): FieldCipher {
  const ring = new Map<number, DerivedKey>();

  for (const key of [...retired, active]) {
    ring.set(key.version, derive(key.secret));
  }

  const current = ring.get(active.version);

  if (current === undefined) {
    throw new Error("The active encryption key is missing from the ring.");
  }

  return {
    activeVersion: active.version,

    encrypt: (plaintext, context) => {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", current.encryption, iv);

      cipher.setAAD(Buffer.from(context, "utf8"));

      const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

      return [
        `v${String(active.version)}`,
        iv.toString("base64"),
        cipher.getAuthTag().toString("base64"),
        body.toString("base64"),
      ].join(":");
    },

    decrypt: (ciphertext, context) => {
      const [version, iv, tag, body] = ciphertext.split(":");

      if (version === undefined || iv === undefined || tag === undefined || body === undefined) {
        throw new Error("Unsupported ciphertext.");
      }

      const parsed = /^v(\d+)$/u.exec(version);
      const key = parsed === null ? undefined : ring.get(Number(parsed[1]));

      if (key === undefined) {
        throw new Error(`No key for ciphertext version ${version}; it was written under a key this service no longer holds.`);
      }

      const decipher = createDecipheriv("aes-256-gcm", key.encryption, Buffer.from(iv, "base64"));

      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));

      return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    },

    lookupHash: (value) => createHmac("sha256", current.lookup).update(value).digest("hex"),
  };
}

export function maskAccountNumber(last4: string): string {
  return `******${last4}`;
}
