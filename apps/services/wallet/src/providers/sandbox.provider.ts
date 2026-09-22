import { WebhookRejectedError } from "./provider.http.js";
import type { PaymentProvider, ProviderOutcome } from "./provider.interface.js";

/** Amounts ending in these kobo mirror the frontend stand-in: 13 fails, 17 expires. */
export const SANDBOX_FAILING_SUFFIX = 13;
export const SANDBOX_EXPIRING_SUFFIX = 17;

const BANKS = Object.freeze([
  { code: "044", name: "Access Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa" },
  { code: "057", name: "Zenith Bank" },
]);

/**
 * Development and test only (refused in production at start-up). No money moves and nothing is contacted:
 * a checkout is instructions, the first check reports PROCESSING and the next one settles.
 */
export function createSandboxProvider(): PaymentProvider {
  return {
    id: "SANDBOX",
    configured: true,

    initiateDeposit: (input) =>
      Promise.resolve({
        providerReference: `sbx_${input.reference}`,
        instructions: {
          title: "Sandbox checkout",
          lines: [
            "No payment provider is contacted in the sandbox.",
            "Check the payment status to move it to processing; check again to settle it.",
          ],
        },
      }),

    verifyDeposit: (check) => {
      const suffix = check.amount % 100;
      const outcome: ProviderOutcome =
        check.attempt <= 1
          ? { kind: "PROCESSING" }
          : suffix === SANDBOX_FAILING_SUFFIX
            ? { kind: "FAILED" }
            : suffix === SANDBOX_EXPIRING_SUFFIX
              ? { kind: "EXPIRED" }
              : { kind: "SUCCEEDED", amount: check.amount, currency: "NGN" };

      return Promise.resolve(outcome);
    },

    listBanks: () => Promise.resolve(BANKS),

    resolveAccount: (bankCode, accountNumber) =>
      Promise.resolve(
        accountNumber.startsWith("000") || !BANKS.some((bank) => bank.code === bankCode)
          ? undefined
          : { accountName: `SANDBOX HOLDER ${accountNumber.slice(-4)}` },
      ),

    transfer: (input) =>
      Promise.resolve({
        providerReference: `sbx_${input.reference}`,
        recipientCode: undefined,
        outcome: { kind: "PROCESSING" },
      }),

    transferStatus: (check) => {
      const outcome: ProviderOutcome =
        check.attempt <= 1
          ? { kind: "PROCESSING" }
          : check.amount % 100 === SANDBOX_FAILING_SUFFIX
            ? { kind: "FAILED" }
            : { kind: "SUCCEEDED", amount: check.amount, currency: "NGN" };

      return Promise.resolve(outcome);
    },

    parseWebhook: () => {
      throw new WebhookRejectedError("The sandbox has no webhooks.");
    },

    probe: () => Promise.resolve(),
  };
}
