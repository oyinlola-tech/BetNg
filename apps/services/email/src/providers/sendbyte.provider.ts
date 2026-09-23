import { verifyWebhookSignature, WebhookSignatureError } from "@betng/service-kit";
import type { SendByteSettings } from "../configs/index.js";
import {
  callProvider,
  dateField,
  ProviderUnavailableError,
  record,
  stringField,
  WebhookRejectedError,
} from "./provider.http.js";
import type { DeliveryEvent, EmailProvider, OutboundEmail, SendResult, WebhookOutcome } from "./provider.interface.js";

const PROVIDER = "sendbyte";

/** `sendbyte-signature: t=<unix>,v1=<hex>`, HMAC-SHA256 over `"<t>.<raw body>"`. */
const SIGNATURE_HEADER = "sendbyte-signature";

const OUTCOMES: Readonly<Record<string, WebhookOutcome>> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
};

export interface SendByteOptions {
  readonly settings: SendByteSettings;
  readonly from: string;
  readonly fromName: string;
  readonly timeoutMs: number;
  readonly toleranceSeconds: number;
}

export function createSendByteProvider(options: SendByteOptions): EmailProvider {
  const { settings } = options;
  const secretKey = settings.apiKey.reveal();
  const webhookSecrets = settings.webhookSecrets.map((secret) => secret.reveal());
  // A display name with a comma or a quote would break the address list, so the config refuses one.
  const from = `${options.fromName} <${options.from}>`;

  return {
    id: PROVIDER,
    configured: true,

    send: async (message: OutboundEmail): Promise<SendResult> => {
      const answer = record(
        await callProvider({
          provider: PROVIDER,
          baseUrl: settings.baseUrl,
          path: "/v1/emails",
          method: "POST",
          secretKey,
          timeoutMs: options.timeoutMs,
          idempotencyKey: message.idempotencyKey,
          body: {
            from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.replyTo === undefined ? {} : { reply_to: message.replyTo }),
            ...(message.tags.length === 0 ? {} : { tags: message.tags }),
            idempotency_key: message.idempotencyKey,
            // Opening and click tracking rewrite links and add a pixel; neither belongs on a code email.
            tracking: { opens: false, clicks: false },
          },
        }),
      );

      return {
        providerId: stringField(answer, "id"),
        providerStatus: stringField(answer, "status"),
      };
    },

    parseWebhook: (rawBody: Uint8Array, header): DeliveryEvent => {
      try {
        verifyWebhookSignature({
          body: rawBody,
          header: header(SIGNATURE_HEADER),
          secrets: webhookSecrets,
          toleranceSeconds: options.toleranceSeconds,
        });
      } catch (error) {
        // The reason is kept, the signature is not: it would tell a prober how close a guess was.
        throw new WebhookRejectedError(
          error instanceof WebhookSignatureError ? `SendByte signature ${error.reason.toLowerCase()}.` : "SendByte signature could not be checked.",
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBody));
      } catch {
        throw new WebhookRejectedError("SendByte webhook body is not JSON.");
      }

      const envelope = record(parsed);
      const eventId = stringField(envelope, "id");
      const eventType = stringField(envelope, "type");

      if (eventId === undefined || eventType === undefined) {
        throw new WebhookRejectedError("SendByte webhook carries no event id or type.");
      }

      const data = record(envelope?.["data"]);
      const outcome = OUTCOMES[eventType] ?? "IGNORED";
      // A soft bounce is retried by the provider; only a permanent one suppresses the address.
      const permanent = eventType === "email.complained" || stringField(data, "bounce_type") !== "soft";

      return {
        eventId: eventId.slice(0, 200),
        eventType: eventType.slice(0, 60),
        providerId: stringField(data, "email_id"),
        outcome,
        occurredAt: dateField(envelope, "created_at"),
        address: stringField(data, "to")?.toLowerCase(),
        permanent,
      };
    },

    probe: async (): Promise<void> => {
      try {
        await callProvider({
          provider: PROVIDER,
          baseUrl: settings.baseUrl,
          path: "/v1/emails?limit=1",
          method: "GET",
          secretKey,
          timeoutMs: options.timeoutMs,
        });
      } catch (error) {
        if (error instanceof ProviderUnavailableError) {
          throw error;
        }
        // A 4xx still proves the provider answered.
      }
    },
  };
}
