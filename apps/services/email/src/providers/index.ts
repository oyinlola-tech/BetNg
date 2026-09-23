import type { Logger } from "@betng/service-kit";
import type { EmailSettings } from "../configs/index.js";
import { createLogProvider } from "./log.provider.js";
import { createSendByteProvider } from "./sendbyte.provider.js";
import type { EmailProvider } from "./provider.interface.js";

export {
  callProvider,
  ProviderRefusedError,
  ProviderUnavailableError,
  WebhookRejectedError,
} from "./provider.http.js";
export { createLogProvider } from "./log.provider.js";
export { createSendByteProvider } from "./sendbyte.provider.js";
export type {
  DeliveryEvent,
  EmailProvider,
  HeaderReader,
  OutboundEmail,
  SendResult,
  WebhookOutcome,
} from "./provider.interface.js";

export function createProvider(settings: EmailSettings, logger: Logger): EmailProvider {
  if (settings.provider === "sendbyte" && settings.sendbyte !== undefined) {
    return createSendByteProvider({
      settings: settings.sendbyte,
      from: settings.from,
      fromName: settings.fromName,
      timeoutMs: settings.timeoutMs,
      toleranceSeconds: settings.webhookToleranceSeconds,
    });
  }

  return createLogProvider(logger);
}
