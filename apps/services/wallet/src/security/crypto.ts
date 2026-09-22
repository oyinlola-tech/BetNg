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
import type { Secret } from "../configs/index.js";

const VERSION = "v1";
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
}

/** AES-256-GCM with the owner id as associated data, so a ciphertext copied to another user's row does not open. */
export function createFieldCipher(secret: Secret): FieldCipher {
  const master = Buffer.from(secret.reveal(), "base64");
  const encryptionKey = Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "betng-wallet/bank-account/enc", 32));
  const lookupKey = Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), "betng-wallet/bank-account/lookup", 32));

  return {
    encrypt: (plaintext, context) => {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);

      cipher.setAAD(Buffer.from(context, "utf8"));

      const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

      return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
    },

    decrypt: (ciphertext, context) => {
      const [version, iv, tag, body] = ciphertext.split(":");

      if (version !== VERSION || iv === undefined || tag === undefined || body === undefined) {
        throw new Error("Unsupported ciphertext.");
      }

      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));

      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));

      return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    },

    lookupHash: (value) => createHmac("sha256", lookupKey).update(value).digest("hex"),
  };
}

export function maskAccountNumber(last4: string): string {
  return `******${last4}`;
}
