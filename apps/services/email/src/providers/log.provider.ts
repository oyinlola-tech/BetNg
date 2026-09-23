import { randomUUID } from "node:crypto";
import type { Logger } from "@betng/service-kit";
import { maskEmail } from "../utils/index.js";
import { WebhookRejectedError } from "./provider.http.js";
import type { EmailProvider } from "./provider.interface.js";

/**
 * Development only, refused in production by the config loader. It records that a message was handed
 * over — never its body, which is where a verification code would be.
 */
export function createLogProvider(logger: Logger): EmailProvider {
  return {
    id: "log",
    configured: true,

    send: (message) => {
      logger.info("Email handed to the log adapter", {
        event: "email_logged",
        to: maskEmail(message.to),
        subject: message.subject,
      });

      return Promise.resolve({ providerId: `log_${randomUUID()}`, providerStatus: "queued" });
    },

    parseWebhook: () => {
      throw new WebhookRejectedError("The log adapter receives no webhooks.");
    },

    probe: () => Promise.resolve(),
  };
}
