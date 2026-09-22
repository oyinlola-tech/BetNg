import type { PaymentMethod } from "@betng/contracts";
import type { FlutterwaveSettings } from "../configs/index.js";
import { constantTimeEqual } from "../security/crypto.js";
import {
  bodyDigest,
  callProvider,
  koboToNaira,
  nairaToKobo,
  parseJson,
  ProviderRefusedError,
  ProviderUnavailableError,
  record,
  stringField,
  WebhookRejectedError,
} from "./provider.http.js";
import type { PaymentProvider, ProviderOutcome, WebhookEvent } from "./provider.interface.js";

const OPTIONS: Readonly<Record<PaymentMethod, string>> = Object.freeze({
  CARD: "card",
  BANK_TRANSFER: "banktransfer",
  USSD: "ussd",
});

function data(answer: unknown): unknown {
  const body = record(answer);

  if (body?.["status"] !== "success") {
    throw new ProviderUnavailableError("FLUTTERWAVE", "unexpected response");
  }

  return body["data"];
}

function succeeded(payload: unknown): ProviderOutcome {
  const amount = nairaToKobo(record(payload)?.["amount"]);
  const currency = stringField(payload, "currency");

  if (amount === undefined || currency === undefined) {
    throw new ProviderUnavailableError("FLUTTERWAVE", "success without amount");
  }

  return { kind: "SUCCEEDED", amount, currency };
}

function chargeOutcome(payload: unknown): ProviderOutcome {
  switch (stringField(payload, "status")?.toLowerCase()) {
    case "successful":
      return succeeded(payload);
    case "failed":
      return { kind: "FAILED" };
    case "cancelled":
      return { kind: "PENDING" };
    default:
      return { kind: "PROCESSING" };
  }
}

function transferOutcome(payload: unknown): ProviderOutcome {
  switch (stringField(payload, "status")?.toUpperCase()) {
    case "SUCCESSFUL":
      return succeeded(payload);
    case "FAILED":
      return { kind: "FAILED" };
    default:
      return { kind: "PROCESSING" };
  }
}

export function createFlutterwaveProvider(settings: FlutterwaveSettings, timeoutMs: number): PaymentProvider {
  const secretKey = settings.secretKey.reveal();
  const webhookHash = settings.webhookHash.reveal();

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    return callProvider({
      provider: "FLUTTERWAVE",
      baseUrl: settings.baseUrl,
      path: `/v3${path}`,
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
      if (error instanceof ProviderRefusedError && (error.status === 404 || error.status === 400)) {
        return undefined;
      }

      throw error;
    }
  }

  return {
    id: "FLUTTERWAVE",
    configured: true,

    initiateDeposit: async (input) => {
      const payload = data(
        await call("POST", "/payments", {
          tx_ref: input.reference,
          amount: koboToNaira(input.amount),
          currency: "NGN",
          redirect_url: input.callbackUrl,
          payment_options: OPTIONS[input.method],
          customer: { email: input.email },
          customizations: { title: "BetNG deposit" },
        }),
      );
      const checkoutUrl = stringField(payload, "link");

      if (checkoutUrl === undefined) {
        throw new ProviderUnavailableError("FLUTTERWAVE", "no link");
      }

      return { checkoutUrl };
    },

    verifyDeposit: async (check) => {
      const payload = await lookup(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(check.reference)}`);

      if (payload === undefined) {
        return { kind: "NOT_FOUND" };
      }

      return stringField(payload, "tx_ref") === check.reference ? chargeOutcome(payload) : { kind: "NOT_FOUND" };
    },

    listBanks: async () => {
      const rows = data(await call("GET", "/banks/NG"));

      if (!Array.isArray(rows)) {
        throw new ProviderUnavailableError("FLUTTERWAVE", "bank list is not a list");
      }

      return rows.flatMap((row) => {
        const code = stringField(row, "code");
        const name = stringField(row, "name");

        return code === undefined || name === undefined ? [] : [{ code, name }];
      });
    },

    resolveAccount: async (bankCode, accountNumber) => {
      let payload: unknown;

      try {
        payload = data(await call("POST", "/accounts/resolve", { account_number: accountNumber, account_bank: bankCode }));
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
      const payload = data(
        await call("POST", "/transfers", {
          account_bank: input.bankCode,
          account_number: input.accountNumber,
          amount: koboToNaira(input.amount),
          narration: input.narration,
          currency: "NGN",
          debit_currency: "NGN",
          reference: input.reference,
        }),
      );

      return { providerReference: stringField(payload, "id"), recipientCode: undefined, outcome: transferOutcome(payload) };
    },

    transferStatus: async (check) => {
      if (check.providerReference === undefined || !/^\d{1,20}$/u.test(check.providerReference)) {
        return { kind: "NOT_FOUND" };
      }

      const payload = await lookup(`/transfers/${check.providerReference}`);

      if (payload === undefined || stringField(payload, "reference") !== check.reference) {
        return { kind: "NOT_FOUND" };
      }

      return transferOutcome(payload);
    },

    parseWebhook: (rawBody, header) => {
      const signature = header("verif-hash");

      if (signature === undefined || !constantTimeEqual(webhookHash, signature)) {
        throw new WebhookRejectedError("The Flutterwave verif-hash does not match.");
      }

      const body = record(parseJson(rawBody));
      const event = (stringField(body, "event") ?? stringField(body, "event.type") ?? "unknown").toLowerCase();
      const payload = body?.["data"];
      const id = stringField(payload, "id") ?? bodyDigest(rawBody);
      const subject: WebhookEvent["subject"] =
        event === "charge.completed" ? "DEPOSIT" : event === "transfer.completed" ? "TRANSFER" : "IGNORED";

      return {
        eventId: `${event}:${id}`.slice(0, 200),
        eventType: event.slice(0, 80),
        subject,
        reference: subject === "DEPOSIT" ? stringField(payload, "tx_ref") : stringField(payload, "reference"),
        amount: nairaToKobo(record(payload)?.["amount"]),
        currency: stringField(payload, "currency"),
      };
    },

    probe: async () => {
      data(await call("GET", "/banks/NG"));
    },
  };
}
