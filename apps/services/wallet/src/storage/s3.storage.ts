import { createHash, createHmac } from "node:crypto";
import type { StorageSettings } from "../configs/index.js";

export interface StorageProvider {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** A short-lived https GET URL signed with SigV4 query authentication. */
  presignGet(key: string, expiresSeconds: number, options?: { readonly filename?: string; readonly now?: Date }): string;
}

const ALGORITHM = "AWS4-HMAC-SHA256";
const UPLOAD_TIMEOUT_MS = 15_000;

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

/** RFC 3986 encoding as SigV4 requires; `/` is kept for object paths. */
function encode(value: string, keepSlash = false): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return keepSlash ? encoded.replace(/%2F/gu, "/") : encoded;
}

function stamps(now: Date): { readonly amzDate: string; readonly day: string } {
  const amzDate = now.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}/u, "");

  return { amzDate, day: amzDate.slice(0, 8) };
}

export function createS3Storage(settings: StorageSettings): StorageProvider {
  const endpoint = new URL(settings.endpoint);
  const host = settings.forcePathStyle ? endpoint.host : `${settings.bucket}.${endpoint.host}`;

  function objectPath(key: string): string {
    return settings.forcePathStyle ? `/${encode(settings.bucket)}/${encode(key, true)}` : `/${encode(key, true)}`;
  }

  function signingKey(day: string): Buffer {
    const dateKey = hmac(`AWS4${settings.secretAccessKey.reveal()}`, day);

    return hmac(hmac(hmac(dateKey, settings.region), "s3"), "aws4_request");
  }

  function signature(day: string, amzDate: string, canonicalRequest: string): string {
    const scope = `${day}/${settings.region}/s3/aws4_request`;
    const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

    return createHmac("sha256", signingKey(day)).update(stringToSign, "utf8").digest("hex");
  }

  return {
    put: async (key, body, contentType) => {
      const { amzDate, day } = stamps(new Date());
      const path = objectPath(key);
      const payloadHash = sha256Hex(body);
      const headers: Record<string, string> = {
        "content-type": contentType,
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      };
      const signedHeaders = Object.keys(headers).sort().join(";");
      const canonicalHeaders = Object.keys(headers)
        .sort()
        .map((name) => `${name}:${headers[name] ?? ""}\n`)
        .join("");
      const canonicalRequest = ["PUT", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
      const authorization =
        `${ALGORITHM} Credential=${settings.accessKeyId.reveal()}/${day}/${settings.region}/s3/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature(day, amzDate, canonicalRequest)}`;

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, UPLOAD_TIMEOUT_MS);

      try {
        const response = await fetch(`${endpoint.protocol}//${host}${path}`, {
          method: "PUT",
          headers: {
            "content-type": contentType,
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
            authorization,
          },
          body,
          redirect: "error",
          signal: controller.signal,
        });

        await response.arrayBuffer().catch(() => undefined);

        if (!response.ok) {
          throw new Error(`Storage refused the upload with ${String(response.status)}.`);
        }
      } finally {
        clearTimeout(timer);
      }
    },

    presignGet: (key, expiresSeconds, options = {}) => {
      const { amzDate, day } = stamps(options.now ?? new Date());
      const path = objectPath(key);
      const query: Record<string, string> = {
        "X-Amz-Algorithm": ALGORITHM,
        "X-Amz-Credential": `${settings.accessKeyId.reveal()}/${day}/${settings.region}/s3/aws4_request`,
        "X-Amz-Date": amzDate,
        "X-Amz-Expires": String(expiresSeconds),
        "X-Amz-SignedHeaders": "host",
        ...(options.filename === undefined
          ? {}
          : { "response-content-disposition": `attachment; filename="${options.filename}"` }),
      };
      const canonicalQuery = Object.keys(query)
        .sort()
        .map((name) => `${encode(name)}=${encode(query[name] ?? "")}`)
        .join("&");
      const canonicalRequest = ["GET", path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");

      return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature(day, amzDate, canonicalRequest)}`;
    },
  };
}
