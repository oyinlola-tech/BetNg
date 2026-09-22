import { createSign } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import type { PushProviderConfig } from "../../configs/index.js";
import type { PushProvider } from "../../interfaces/index.js";
import { DeliveryError, postJson } from "./deliveryError.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const ASSERTION_LIFETIME_S = 3600;
const REFRESH_MARGIN_MS = 120_000;

const base64url = (value: string | Buffer): string => Buffer.from(value).toString("base64url");

/** A service-account assertion (RFC 7523) signed RS256 with node:crypto. */
function signAssertion(config: Extract<PushProviderConfig, { provider: "fcm" }>, nowS: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowS, exp: nowS + ASSERTION_LIFETIME_S }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(config.privateKey);

  return `${header}.${claims}.${base64url(signature)}`;
}

interface AccessToken {
  readonly value: string;
  readonly expiresAtMs: number;
}

/** FCM HTTP v1. The OAuth token is cached until shortly before it expires; one refresh runs at a time. */
function fcm(config: Extract<PushProviderConfig, { provider: "fcm" }>, timeoutMs: number): PushProvider {
  const sendUrl = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`;
  let cached: AccessToken | undefined;
  let refreshing: Promise<AccessToken> | undefined;

  const fetchToken = async (): Promise<AccessToken> => {
    const nowMs = Date.now();
    const response = await postJson("fcm-oauth", TOKEN_URL, {
      timeoutMs,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signAssertion(config, Math.floor(nowMs / 1000)),
      }).toString(),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new DeliveryError("fcm-oauth", response.status, "rejected");
    }

    const body = (await response.json()) as { access_token?: unknown; expires_in?: unknown };

    if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
      throw new DeliveryError("fcm-oauth", response.status, "malformed token response");
    }

    return { value: body.access_token, expiresAtMs: nowMs + body.expires_in * 1000 };
  };

  const accessToken = async (): Promise<string> => {
    if (cached !== undefined && cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) {
      return cached.value;
    }

    refreshing ??= fetchToken().finally(() => {
      refreshing = undefined;
    });
    cached = await refreshing;

    return cached.value;
  };

  return {
    name: "fcm",
    send: async (message) => {
      const response = await postJson("fcm", sendUrl, {
        timeoutMs,
        headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: { title: message.title, body: message.body },
            data: message.data,
          },
        }),
      });

      await response.body?.cancel();

      if (response.status === 404) {
        return "unregistered";
      }

      if (response.status === 401) {
        cached = undefined;
      }

      if (!response.ok) {
        throw new DeliveryError("fcm", response.status, "rejected");
      }

      return "delivered";
    },
  };
}

function logPush(logger: Logger): PushProvider {
  return {
    name: "log",
    send: (message) => {
      logger.info("Push handed to the log adapter", { event: "push_logged", title: message.title });

      return Promise.resolve("delivered");
    },
  };
}

export function createPushProvider(config: PushProviderConfig, timeoutMs: number, logger: Logger): PushProvider | undefined {
  if (config.provider === "fcm") {
    return fcm(config, timeoutMs);
  }

  return config.provider === "log" ? logPush(logger) : undefined;
}
