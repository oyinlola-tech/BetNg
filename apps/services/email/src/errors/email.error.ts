import { ErrorCodes } from "@betng/contracts";
import { DomainError } from "@zudojs/errors";

export class UnknownTemplateError extends DomainError {
  public constructor(template: string) {
    super(`There is no email template named ${template}.`, {
      code: ErrorCodes.VALIDATION_FAILED,
      statusCode: 422,
      expose: true,
      metadata: { template },
    });

    this.name = "UnknownTemplateError";
  }
}

export class MissingVariableError extends DomainError {
  public constructor(template: string, variable: string) {
    super(`The ${template} template needs a ${variable} value.`, {
      code: ErrorCodes.VALIDATION_FAILED,
      statusCode: 422,
      expose: true,
      metadata: { template, variable },
    });

    this.name = "MissingVariableError";
  }
}

/** The address bounced or complained before. Sending again would damage the sending domain. */
export class SuppressedAddressError extends DomainError {
  public constructor() {
    super("That address is on the suppression list and will not be emailed.", {
      code: ErrorCodes.CONFLICT,
      statusCode: 409,
      expose: true,
    });

    this.name = "SuppressedAddressError";
  }
}

export class DeliveryUnavailableError extends DomainError {
  public constructor(detail: string) {
    super("The email provider could not be reached.", {
      code: ErrorCodes.UPSTREAM_UNAVAILABLE,
      statusCode: 503,
      expose: true,
      metadata: { detail },
    });

    this.name = "DeliveryUnavailableError";
  }
}

export class DeliveryRefusedError extends DomainError {
  public constructor(status: number, code: string | undefined) {
    super("The email provider refused the message.", {
      code: ErrorCodes.VALIDATION_FAILED,
      statusCode: 422,
      expose: true,
      metadata: { status, providerCode: code },
    });

    this.name = "DeliveryRefusedError";
  }
}

export class MessageNotFoundError extends DomainError {
  public constructor(id: string) {
    super(`No email message with id ${id}.`, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: 404,
      expose: true,
      metadata: { id },
    });

    this.name = "MessageNotFoundError";
  }
}
