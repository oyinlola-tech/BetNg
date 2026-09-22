import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface DataProtector {
  /** `context` is bound as associated data: a ciphertext moved to another row or purpose fails to decrypt. */
  encrypt(plaintext: string, context: string): string;
  decrypt(sealed: string, context: string): string;
  /** Keyed hash for values that must be looked up but never recovered (backup codes, identity numbers, push tokens). */
  digest(purpose: string, value: string): string;
}

function derive(key: Buffer, label: string): Buffer {
  return Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), `betng-identity:${label}`, 32));
}

export function createDataProtector(masterKey: Buffer): DataProtector {
  if (masterKey.length !== 32) {
    throw new Error("The identity data key must be 32 bytes.");
  }

  const encryptionKey = derive(masterKey, "aes-256-gcm:v1");
  const macKey = derive(masterKey, "hmac-sha256:v1");

  return {
    encrypt: (plaintext, context) => {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: TAG_BYTES });

      cipher.setAAD(Buffer.from(context, "utf8"));

      const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

      return [VERSION, iv.toString("base64url"), body.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
    },
    decrypt: (sealed, context) => {
      const [version, iv, body, tag] = sealed.split(".");

      if (version !== VERSION || iv === undefined || body === undefined || tag === undefined) {
        throw new Error("The sealed value is not in a known format.");
      }

      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64url"), { authTagLength: TAG_BYTES });

      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));

      return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
    },
    digest: (purpose, value) => createHmac("sha256", macKey).update(`${purpose}\u0000${value}`, "utf8").digest("hex"),
  };
}
