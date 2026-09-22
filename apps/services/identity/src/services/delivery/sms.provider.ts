import type { Logger } from "@betng/service-kit";
import type { SmsProviderConfig } from "../../configs/index.js";
import type { SmsProvider } from "../../interfaces/index.js";
import { maskPhone } from "../../utils/index.js";
import { DeliveryError, postJson } from "./deliveryError.js";

/** Termii "Send message" (POST {base}/api/sms/send). The base URL is the one shown on the account's dashboard. */
function termii(config: Extract<SmsProviderConfig, { provider: "termii" }>, timeoutMs: number): SmsProvider {
  const url = `${config.baseUrl.replace(/\/+$/u, "")}/api/sms/send`;

  return {
    name: "termii",
    send: async (message) => {
      const response = await postJson("termii", url, {
        timeoutMs,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.apiKey,
          to: message.to,
          from: config.senderId,
          sms: message.text,
          type: "plain",
          channel: config.channel,
        }),
      });

      await response.body?.cancel();

      if (!response.ok) {
        throw new DeliveryError("termii", response.status, "rejected");
      }
    },
  };
}

function logSms(logger: Logger): SmsProvider {
  return {
    name: "log",
    send: (message) => {
      logger.info("SMS handed to the log adapter", { event: "sms_logged", to: maskPhone(message.to) });

      return Promise.resolve();
    },
  };
}

export function createSmsProvider(config: SmsProviderConfig, timeoutMs: number, logger: Logger): SmsProvider | undefined {
  if (config.provider === "termii") {
    return termii(config, timeoutMs);
  }

  return config.provider === "log" ? logSms(logger) : undefined;
}

/** Nigerian numbers to 234XXXXXXXXXX; anything else is not sent to. */
export function toInternationalNumber(phone: string | null): string | undefined {
  if (phone === null) {
    return undefined;
  }

  const digits = phone.replace(/\D/gu, "");
  const international = digits.startsWith("0") && digits.length === 11 ? `234${digits.slice(1)}` : digits;

  return /^234\d{10}$/u.test(international) ? international : undefined;
}
