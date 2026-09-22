import type { Logger } from "@betng/service-kit";
import type { WebPushConfig } from "../../configs/index.js";
import type { PushProvider } from "../../interfaces/index.js";
import { DeliveryError } from "./deliveryError.js";
import { encryptPayload, MAX_PLAINTEXT_BYTES, parseSubscription, vapidAuthorization, vapidSigningKey } from "./webPush.crypto.js";
import type { VapidKeys } from "./webPush.crypto.js";

const TTL_SECONDS = 86_400;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REFERENCE = /^[A-Za-z0-9_-]{6,64}$/u;

export interface WebPushNotice {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag?: string;
}

function identified(value: string | undefined, pattern: RegExp): string | undefined {
  return value !== undefined && pattern.test(value) ? value : undefined;
}

/** The click target is a same-origin path built only from validated identifiers; nothing else in `data` leaves the server. */
export function webPushNotice(title: string, body: string, data: Readonly<Record<string, string>>): WebPushNotice {
  const kind = data["kind"] ?? "";
  const betId = identified(data["betId"], UUID);
  const matchId = identified(data["matchId"], UUID);
  const reference = identified(data["reference"], REFERENCE);
  const target = ((): { readonly url: string; readonly id?: string | undefined } => {
    switch (kind) {
      case "BET_SETTLED":
      case "BET_ACCEPTED":
        return betId === undefined ? { url: "/tickets" } : { url: `/tickets/${betId}`, id: betId };
      case "PAYMENT_UPDATED":
        return reference === undefined ? { url: "/payments" } : { url: `/payments/${reference}`, id: reference };
      case "RESULT_AVAILABLE":
        return matchId === undefined ? { url: "/results" } : { url: `/results/${matchId}`, id: matchId };
      case "MATCH_STARTING":
      case "MATCH_FINISHED":
      case "MATCH_EVENT":
        return matchId === undefined ? { url: "/" } : { url: `/matches/${matchId}`, id: matchId };
      case "KYC_UPDATED":
        return { url: "/kyc" };
      case "SECURITY_ALERT":
        return { url: "/account/security" };
      case "LIMIT_WARNING":
        return { url: "/responsible-gaming" };
      default:
        return { url: "/notifications" };
    }
  })();
  const tag = /^[A-Z_]{1,32}$/u.test(kind) ? (target.id === undefined ? kind : `${kind}:${target.id}`) : undefined;

  return { title, body, url: target.url, ...(tag === undefined ? {} : { tag }) };
}

export interface WebPushOptions {
  readonly now?: () => number;
}

/** Sends to browser PushSubscription endpoints (RFC 8030) with VAPID (RFC 8292) and an aes128gcm payload (RFC 8291). */
export function createWebPushProvider(config: WebPushConfig, timeoutMs: number, logger: Logger, options: WebPushOptions = {}): PushProvider {
  const keys: VapidKeys = config.keys;
  const signingKey = vapidSigningKey(keys);
  const now = options.now ?? Date.now;

  return {
    name: "webpush",
    send: async (message) => {
      const subscription = parseSubscription(message.token);

      if (subscription === undefined) {
        logger.warn("A stored web push subscription is malformed and was dropped", { event: "web_push_subscription_invalid" });

        return "unregistered";
      }

      const host = new URL(subscription.endpoint).host;
      const notice = webPushNotice(message.title, message.body, message.data);
      let plaintext = Buffer.from(JSON.stringify(notice));

      if (plaintext.length > MAX_PLAINTEXT_BYTES) {
        plaintext = Buffer.from(JSON.stringify({ ...notice, title: notice.title.slice(0, 200), body: notice.body.slice(0, 500) }));
      }

      let response: Response;

      try {
        response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            authorization: vapidAuthorization(keys, signingKey, subscription.endpoint, Math.floor(now() / 1000)),
            "content-encoding": "aes128gcm",
            "content-type": "application/octet-stream",
            ttl: String(TTL_SECONDS),
            urgency: "normal",
          },
          body: encryptPayload(subscription, plaintext),
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new DeliveryError("webpush", undefined, error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error");
      }

      await response.body?.cancel();

      if (response.status === 404 || response.status === 410) {
        logger.info("Web push subscription expired and was removed", { event: "web_push_unregistered", host, status: response.status });

        return "unregistered";
      }

      if (!response.ok) {
        throw new DeliveryError("webpush", response.status, "rejected");
      }

      return "delivered";
    },
  };
}
