import { createRpcClient } from "@betng/service-kit";
import type { Logger, ServiceEndpoint } from "@betng/service-kit";
import type { EmailProvider } from "../../interfaces/index.js";
import { maskEmail } from "../../utils/index.js";
import { DeliveryError } from "./deliveryError.js";

const SEND = "email.send";

interface SendPayload {
  readonly to: string;
  readonly template: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly idempotencyKey: string;
}

/**
 * Identity composes nothing and holds no provider key: it names a template the email service owns and
 * hands over the values. Codes and one-time credentials cross this call and are never written down.
 */
export function createEmailProvider(endpoint: ServiceEndpoint): EmailProvider & { close(): Promise<void> } {
  const client = createRpcClient(endpoint);

  return {
    name: "email-service",
    send: async (message) => {
      try {
        await client.call<SendPayload, { id: string; duplicate: boolean }>(SEND, {
          to: message.to,
          template: message.template,
          variables: message.variables,
          idempotencyKey: message.idempotencyKey,
        });
      } catch (error) {
        // The address never reaches the error, only the template that failed.
        throw new DeliveryError("email-service", 0, `${message.template}: ${error instanceof Error ? error.name : "unknown"}`);
      }
    },
    close: async () => {
      await client.close();
    },
  };
}

/** Development only (refused in production by the config loader): records that a message was sent, never its body. */
export function createLoggingEmailProvider(logger: Logger): EmailProvider {
  return {
    name: "log",
    send: (message) => {
      logger.info("Email handed to the log adapter", {
        event: "email_logged",
        to: maskEmail(message.to),
        template: message.template,
      });

      return Promise.resolve();
    },
  };
}
