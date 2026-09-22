import type { Bank, PaymentMethod } from "@betng/contracts";
import type { PaystackSettings } from "../configs/index.js";
import { constantTimeEqual, hmacSha512Hex } from "../security/crypto.js";
import {
  bodyDigest,
  callProvider,
  integerField,
  parseJson,
  ProviderRefusedError,
  ProviderUnavailableError,
  record,
  stringField,
  WebhookRejectedError,
} from "./provider.http.js";
import type { PaymentProvider, ProviderOutcome, WebhookEvent } from "./provider.interface.js";

const CHANNELS: Readonly<Record<PaymentMethod, readonly string[]>> = Object.freeze({
  CARD: ["card"],
  BANK_TRANSFER: ["bank_transfer"],
  USSD: ["ussd"],
});

const MAX_BANK_PAGES = 10;

function data(answer: unknown): unknown {
  const body = record(answer);

  if (body?.["status"] !== true) {
    throw new ProviderUnavailableError("PAYSTACK", "unexpected response");
  }

  return body["data"];
}

function chargeOutcome(payload: unknown): ProviderOutcome {
  const status = stringField(payload, "status");

  switch (status) {
    case "success": {
      const amount = integerField(payload, "amount");
      const currency = stringField(payload, "currency");

      if (amount === undefined || currency === undefined) {
        throw new ProviderUnavailableError("PAYSTACK", "success without amount");
      }

      return { kind: "SUCCEEDED", amount, currency };
    }
    case "failed":
      return { kind: "FAILED" };
    case "reversed":
      return { kind: "REVERSED" };
    case "abandoned":
      return { kind: "PENDING" };
    default:
      return { kind: "PROCESSING" };
  }
}

function transferOutcome(payload: unknown): ProviderOutcome {
  const status = stringField(payload, "status");

  switch (status) {
    case "success": {
      const amount = integerField(payload, "amount");

      if (amount === undefined) {
        throw new ProviderUnavailableError("PAYSTACK", "success without amount");
      }

      return { kind: "SUCCEEDED", amount, currency: stringField(payload, "currency") ?? "NGN" };
    }
    case "failed":
    case "abandoned":
    case "blocked":
    case "rejected":
      return { kind: "FAILED" };
    case "reversed":
      return { kind: "REVERSED" };
    default:
      return { kind: "PROCESSING" };
  }
}

export function createPaystackProvider(settings: PaystackSettings, timeoutMs: number): PaymentProvider {
  const secretKey = settings.secretKey.reveal();

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    return callProvider({
      provider: "PAYSTACK",
      baseUrl: settings.baseUrl,
      path,
      method,
      secretKey,
      timeoutMs,
      ...(body === undefined ? {} : { body }),
    });
  }

  async function lookup(path: string): Promise<unknown> {
    try {
      return data(await call("GET", path));
    } catch (error) {
      if (error instanceof ProviderRefusedError && error.status === 404) {
        return undefined;
      }

      throw error;
    }
  }

  return {
    id: "PAYSTACK",
    configured: true,

    initiateDeposit: async (input) => {
      const payload = data(
        await call("POST", "/transaction/initialize", {
          email: input.email,
          amount: input.amount,
          currency: "NGN",
          reference: input.reference,
          callback_url: input.callbackUrl,
          channels: CHANNELS[input.method],
          metadata: { reference: input.reference },
        }),
      );
      const checkoutUrl = stringField(payload, "authorization_url");

      if (checkoutUrl === undefined) {
        throw new ProviderUnavailableError("PAYSTACK", "no authorization_url");
      }

      return { checkoutUrl, providerReference: stringField(payload, "reference") ?? input.reference };
    },

    verifyDeposit: async (check) => {
      const payload = await lookup(`/transaction/verify/${encodeURIComponent(check.reference)}`);

      return payload === undefined ? { kind: "NOT_FOUND" } : chargeOutcome(payload);
    },

    listBanks: async () => {
      const banks: Bank[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_BANK_PAGES; page += 1) {
        const answer = await call(
          "GET",
          `/bank?country=nigeria&currency=NGN&perPage=100&use_cursor=true${cursor === undefined ? "" : `&next=${encodeURIComponent(cursor)}`}`,
        );
        const rows = data(answer);

        if (!Array.isArray(rows)) {
          throw new ProviderUnavailableError("PAYSTACK", "bank list is not a list");
        }

        for (const row of rows) {
          const code = stringField(row, "code");
          const name = stringField(row, "name");

          if (code !== undefined && name !== undefined && record(row)?.["active"] !== false) {
            banks.push({ code, name });
          }
        }

        cursor = stringField(record(answer)?.["meta"], "next");

        if (cursor === undefined) {
          break;
        }
      }

      return banks;
    },

    resolveAccount: async (bankCode, accountNumber) => {
      let payload: unknown;

      try {
        payload = data(
          await call("GET", `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`),
        );
      } catch (error) {
        if (error instanceof ProviderRefusedError && error.status !== 401 && error.status !== 403) {
          return undefined;
        }

        throw error;
      }

      const accountName = stringField(payload, "account_name");

      return accountName === undefined ? undefined : { accountName };
    },

    transfer: async (input) => {
      let recipientCode = input.recipientCode;

      if (recipientCode === undefined) {
        const recipient = data(
          await call("POST", "/transferrecipient", {
            type: "nuban",
            name: input.accountName,
            account_number: input.accountNumber,
            bank_code: input.bankCode,
            currency: "NGN",
          }),
        );

        recipientCode = stringField(recipient, "recipient_code");

        if (recipientCode === undefined) {
          throw new ProviderUnavailableError("PAYSTACK", "no recipient_code");
        }
      }

      const payload = data(
        await call("POST", "/transfer", {
          source: "balance",
          amount: input.amount,
          recipient: recipientCode,
          reference: input.reference,
          reason: input.narration,
          currency: "NGN",
        }),
      );

      return {
        providerReference: stringField(payload, "transfer_code"),
        recipientCode,
        outcome: transferOutcome(payload),
      };
    },

    transferStatus: async (check) => {
      const payload = await lookup(`/transfer/verify/${encodeURIComponent(check.reference)}`);

      return payload === undefined ? { kind: "NOT_FOUND" } : transferOutcome(payload);
    },

    parseWebhook: (rawBody, header) => {
      const signature = header("x-paystack-signature");

      if (signature === undefined || !constantTimeEqual(hmacSha512Hex(secretKey, rawBody), signature.trim().toLowerCase())) {
        throw new WebhookRejectedError("The Paystack signature does not match.");
      }

      const body = record(parseJson(rawBody));
      const event = stringField(body, "event") ?? "unknown";
      const payload = body?.["data"];
      const id = stringField(payload, "id") ?? stringField(payload, "transfer_code") ?? bodyDigest(rawBody);
      const subject: WebhookEvent["subject"] =
        event === "charge.success" ? "DEPOSIT" : event.startsWith("transfer.") ? "TRANSFER" : "IGNORED";

      return {
        eventId: `${event}:${id}`.slice(0, 200),
        eventType: event.slice(0, 80),
        subject,
        reference: stringField(payload, "reference"),
        amount: integerField(payload, "amount"),
        currency: stringField(payload, "currency"),
      };
    },

    probe: async () => {
      data(await call("GET", "/bank?country=nigeria&currency=NGN&perPage=1"));
    },
  };
}
