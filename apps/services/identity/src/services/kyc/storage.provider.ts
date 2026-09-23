// S3-compatible object storage with AWS Signature Version 4 on node:crypto (query-string presigning and header signing).

import { createHash, createHmac, randomUUID } from "node:crypto";
import type { StorageConfig } from "../../configs/index.js";
import { ServiceUnavailableError } from "../../errors/index.js";
import type { DocumentStorage, PresignedDownload, PresignedUpload, StoredObject } from "../../interfaces/index.js";

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
const EMPTY_SHA256 = createHash("sha256").update("").digest("hex");
const REQUEST_TIMEOUT_MS = 8000;

const sha256Hex = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key: Buffer | string, value: string): Buffer => createHmac("sha256", key).update(value, "utf8").digest();

/** RFC 3986 encoding as SigV4 requires: only unreserved characters are left as they are. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function timestamps(now: Date): { readonly amzDate: string; readonly dateStamp: string } {
  const amzDate = now.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}/u, "");

  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

interface Target {
  readonly origin: string;
  readonly host: string;
  readonly path: string;
}

export function createDocumentStorage(config: StorageConfig): DocumentStorage {
  const endpoint = new URL(config.endpoint);

  const target = (key: string): Target => {
    const encodedKey = key.split("/").map(encodeRfc3986).join("/");

    if (config.forcePathStyle) {
      return { origin: endpoint.origin, host: endpoint.host, path: `/${encodeRfc3986(config.bucket)}/${encodedKey}` };
    }

    const host = `${config.bucket}.${endpoint.host}`;

    return { origin: `${endpoint.protocol}//${host}`, host, path: `/${encodedKey}` };
  };

  const signingKey = (dateStamp: string): Buffer =>
    hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), SERVICE), "aws4_request");

  const sign = (canonicalRequest: string, amzDate: string, dateStamp: string): string => {
    const scope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
    const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

    return createHmac("sha256", signingKey(dateStamp)).update(stringToSign, "utf8").digest("hex");
  };

  const presign = (
    method: "GET" | "PUT",
    key: string,
    signed: Readonly<Record<string, string>>,
    expiresSeconds: number,
  ): { readonly url: string; readonly expiresAt: Date } => {
    const now = new Date();
    const { amzDate, dateStamp } = timestamps(now);
    const { origin, host, path } = target(key);
    const headers: Record<string, string> = { ...signed, host };
    const names = Object.keys(headers).sort();
    const signedHeaders = names.join(";");

    const query: Record<string, string> = {
      "X-Amz-Algorithm": ALGORITHM,
      "X-Amz-Credential": `${config.accessKeyId}/${dateStamp}/${config.region}/${SERVICE}/aws4_request`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expiresSeconds),
      "X-Amz-SignedHeaders": signedHeaders,
    };

    const canonicalQuery = Object.keys(query)
      .sort()
      .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(query[name] ?? "")}`)
      .join("&");

    const canonicalHeaders = names.map((name) => `${name}:${(headers[name] ?? "").trim()}\n`).join("");
    const canonicalRequest = [method, path, canonicalQuery, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const signature = sign(canonicalRequest, amzDate, dateStamp);

    return {
      url: `${origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`,
      expiresAt: new Date(now.getTime() + expiresSeconds * 1000),
    };
  };

  const signedFetch = async (method: "GET" | "HEAD", key: string, extra: Readonly<Record<string, string>> = {}): Promise<Response> => {
    const { amzDate, dateStamp } = timestamps(new Date());
    const { origin, host, path } = target(key);
    const headers: Record<string, string> = { ...extra, host, "x-amz-content-sha256": EMPTY_SHA256, "x-amz-date": amzDate };
    const names = Object.keys(headers).sort();
    const signedHeaders = names.join(";");
    const canonicalHeaders = names.map((name) => `${name}:${(headers[name] ?? "").trim()}\n`).join("");
    const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, EMPTY_SHA256].join("\n");
    const signature = sign(canonicalRequest, amzDate, dateStamp);
    const credential = `${config.accessKeyId}/${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
    const { host: _host, ...sent } = headers;

    try {
      return await fetch(`${origin}${path}`, {
        method,
        headers: { ...sent, authorization: `${ALGORITHM} Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableError("Document storage is not reachable. Try again shortly.");
    }
  };

  // Signed, not merely requested: storage refuses a PUT whose encryption headers
  // do not match the signature, so a client cannot opt out of encryption at rest.
  const encryptionHeaders: Readonly<Record<string, string>> =
    config.encryption === undefined
      ? {}
      : {
          "x-amz-server-side-encryption": config.encryption.algorithm,
          ...(config.encryption.kmsKeyId === undefined
            ? {}
            : { "x-amz-server-side-encryption-aws-kms-key-id": config.encryption.kmsKeyId }),
        };

  return {
    presignPut: (key, contentType, sizeBytes, expiresSeconds): PresignedUpload => {
      const { url, expiresAt } = presign(
        "PUT",
        key,
        { "content-length": String(sizeBytes), "content-type": contentType, ...encryptionHeaders },
        expiresSeconds,
      );

      return { url, expiresAt, headers: { "Content-Type": contentType, ...encryptionHeaders } };
    },

    presignGet: (key, expiresSeconds): PresignedDownload => presign("GET", key, {}, expiresSeconds),

    head: async (key): Promise<StoredObject> => {
      const response = await signedFetch("HEAD", key);

      if (response.status === 404 || response.status === 403) {
        return { exists: false };
      }

      if (!response.ok) {
        throw new ServiceUnavailableError("Document storage did not answer. Try again shortly.");
      }

      return {
        exists: true,
        sizeBytes: Number(response.headers.get("content-length") ?? "-1"),
        contentType: response.headers.get("content-type") ?? undefined,
      };
    },

    readPrefix: async (key, bytes) => {
      const response = await signedFetch("GET", key, { range: `bytes=0-${String(bytes - 1)}` });

      if (response.status !== 206 && response.status !== 200) {
        await response.body?.cancel();
        throw new ServiceUnavailableError("Document storage did not answer. Try again shortly.");
      }

      return Buffer.from(await response.arrayBuffer()).subarray(0, bytes);
    },
  };
}

/** Keys never contain anything the client chose. */
export const kycObjectKey = (customerId: string, uploadId: string = randomUUID()): string => `kyc/${customerId}/${uploadId}`;

const SIGNATURES: Readonly<Record<string, readonly number[]>> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
};

export const SIGNATURE_BYTES = 8;

/** The declared type must match the bytes: a renamed executable is not a PDF. */
export function matchesFileSignature(contentType: string, prefix: Buffer): boolean {
  const signature = SIGNATURES[contentType];

  return signature !== undefined && prefix.length >= signature.length && signature.every((byte, index) => prefix[index] === byte);
}
