import { DomainError } from "@zudojs/errors";
import { ErrorCodes } from "@betng/contracts";
import { PAYMENT_ERROR } from "../constants/payments.constant.js";

/** `details` as a plain object is what the shared error handler emits as `error.data`. */
export class PaymentDomainError extends DomainError {
  public readonly details: Readonly<Record<string, unknown>> | undefined;

  public constructor(name: string, message: string, code: string, statusCode: number, data?: Readonly<Record<string, unknown>>) {
    super(message, { code, statusCode });
    this.name = name;
    this.details = data;
  }
}

function domain(name: string, message: string, code: string, statusCode: number, data?: Readonly<Record<string, unknown>>): PaymentDomainError {
  return new PaymentDomainError(name, message, code, statusCode, data);
}

export const paymentErrors = Object.freeze({
  providerUnavailable: () =>
    domain("PaymentProviderUnavailableError", "The payment provider is unavailable. Try again shortly.", PAYMENT_ERROR.PAYMENT_PROVIDER_UNAVAILABLE, 503),

  paymentFailed: (message = "The payment provider declined the payment.") =>
    domain("PaymentFailedError", message, PAYMENT_ERROR.PAYMENT_FAILED, 422),

  identityUnavailable: () =>
    domain(
      "IdentityUnavailableError",
      "Account checks are unavailable, so nothing was done. Try again shortly.",
      ErrorCodes.SERVICE_UNAVAILABLE,
      503,
    ),

  limitRefused: (code: string, message: string) => domain("LimitRefusedError", message, code, code === PAYMENT_ERROR.LIMIT_EXCEEDED ? 409 : 403),

  kycRequired: (message: string, limit?: number) =>
    domain("KycRequiredError", message, PAYMENT_ERROR.KYC_REQUIRED, 403, limit === undefined ? undefined : { limit }),

  notFound: (message = "No payment matches that reference.") => domain("PaymentNotFoundError", message, ErrorCodes.NOT_FOUND, 404),

  conflict: (message: string) => domain("PaymentConflictError", message, ErrorCodes.CONFLICT, 409),

  invalid: (message: string) => domain("PaymentValidationError", message, ErrorCodes.VALIDATION_FAILED, 422),

  forbidden: (message = "You do not have permission to do this.") => domain("PaymentForbiddenError", message, ErrorCodes.FORBIDDEN, 403),

  notConfigured: (what: string) =>
    domain("NotConfiguredError", `${what} is not configured on this platform.`, ErrorCodes.SERVICE_UNAVAILABLE, 503),

  unauthenticatedWebhook: () =>
    domain("WebhookRejectedError", "The webhook signature is not valid.", ErrorCodes.UNAUTHENTICATED, 401),
});
