import { ProviderUnavailableError, WebhookRejectedError } from "./provider.http.js";
import type { PaymentProvider } from "./provider.interface.js";

/**
 * Bachs is a selectable provider name in the contracts, but no API specification exists in this repository, so the
 * adapter does not guess one: every call answers PAYMENT_PROVIDER_UNAVAILABLE and every webhook is refused.
 */
export function createBachsProvider(): PaymentProvider {
  const unavailable = (): Promise<never> => Promise.reject(new ProviderUnavailableError("BACHS", "configuration required"));

  return {
    id: "BACHS",
    configured: false,
    initiateDeposit: unavailable,
    verifyDeposit: unavailable,
    listBanks: unavailable,
    resolveAccount: unavailable,
    transfer: unavailable,
    transferStatus: unavailable,
    parseWebhook: () => {
      throw new WebhookRejectedError("Bachs webhooks are not configured.");
    },
    probe: unavailable,
  };
}
