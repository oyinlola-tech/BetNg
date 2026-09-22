import type { Logger } from "@betng/service-kit";
import type { EmailProviderConfig } from "../../configs/index.js";
import type { EmailProvider } from "../../interfaces/index.js";
import { maskEmail } from "../../utils/index.js";
import { DeliveryError, postJson } from "./deliveryError.js";

const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send";

/** SendGrid v3 mail send; 202 means accepted for delivery. */
function sendGrid(config: Extract<EmailProviderConfig, { provider: "sendgrid" }>, timeoutMs: number): EmailProvider {
  return {
    name: "sendgrid",
    send: async (message) => {
      const response = await postJson("sendgrid", SENDGRID_URL, {
        timeoutMs,
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: config.from, name: config.fromName },
          subject: message.subject,
          content: [{ type: "text/plain", value: message.text }],
          tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
        }),
      });

      await response.body?.cancel();

      if (response.status !== 202) {
        throw new DeliveryError("sendgrid", response.status, "rejected");
      }
    },
  };
}

/** Development only (refused in production by the config loader): records that a message was sent, never its body. */
function logEmail(logger: Logger): EmailProvider {
  return {
    name: "log",
    send: (message) => {
      logger.info("Email handed to the log adapter", { event: "email_logged", to: maskEmail(message.to), subject: message.subject });

      return Promise.resolve();
    },
  };
}

export function createEmailProvider(config: EmailProviderConfig, timeoutMs: number, logger: Logger): EmailProvider {
  return config.provider === "sendgrid" ? sendGrid(config, timeoutMs) : logEmail(logger);
}
