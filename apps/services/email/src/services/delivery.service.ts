import type { Logger } from "@betng/service-kit";
import type { EmailSettings } from "../configs/index.js";
import { WEBHOOK_ROUTE } from "../constants/index.js";
import {
  DeliveryRefusedError,
  DeliveryUnavailableError,
  MissingVariableError,
  SuppressedAddressError,
  UnknownTemplateError,
} from "../errors/index.js";
import type { EmailRepository, MessageRecord } from "../interfaces/index.js";
import type { DeliveryEvent, EmailProvider, HeaderReader } from "../providers/index.js";
import { ProviderRefusedError, ProviderUnavailableError } from "../providers/index.js";
import { findTemplate } from "../templates/index.js";
import { addressHash, maskEmail, normaliseAddress, withoutSecrets } from "../utils/index.js";

export interface SendRequest {
  readonly to: string;
  readonly template: string;
  readonly variables: Readonly<Record<string, string>>;
  readonly idempotencyKey: string;
  readonly tags?: readonly string[];
  readonly replyTo?: string;
}

export interface SendOutcome {
  readonly id: string;
  readonly status: string;
  readonly duplicate: boolean;
}

export type WebhookResult = "applied" | "duplicate" | "ignored" | "unknown_message";

export interface DeliveryServiceOptions {
  readonly repository: EmailRepository;
  readonly provider: EmailProvider;
  readonly settings: EmailSettings;
  readonly logger: Logger;
}

export class DeliveryService {
  readonly #repository: EmailRepository;

  readonly #provider: EmailProvider;

  readonly #settings: EmailSettings;

  readonly #logger: Logger;

  public constructor(options: DeliveryServiceOptions) {
    this.#repository = options.repository;
    this.#provider = options.provider;
    this.#settings = options.settings;
    this.#logger = options.logger;
  }

  /**
   * Renders, records and sends. Idempotent on `idempotencyKey`: a retried call returns the first
   * message instead of sending a second copy, and the same key is handed to the provider so its own
   * retry window collapses too.
   */
  public async send(request: SendRequest): Promise<SendOutcome> {
    const template = findTemplate(request.template);

    if (template === undefined) {
      throw new UnknownTemplateError(request.template);
    }

    for (const required of template.required) {
      if ((request.variables[required] ?? "") === "") {
        throw new MissingVariableError(template.name, required);
      }
    }

    const to = normaliseAddress(request.to);
    const hash = addressHash(to);

    if (await this.#repository.isSuppressed(hash)) {
      throw new SuppressedAddressError();
    }

    const rendered = template.render(request.variables);

    const { message, duplicate } = await this.#repository.createMessage({
      toAddress: to,
      toHash: hash,
      template: template.name,
      subject: rendered.subject,
      // The code, the temporary password and the PIN are rendered above and dropped here.
      variables: withoutSecrets(request.variables, template.secretVariables),
      tags: request.tags ?? [],
      idempotencyKey: request.idempotencyKey,
    });

    if (duplicate) {
      return { id: message.id, status: message.status, duplicate: true };
    }

    try {
      const result = await this.#provider.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: request.replyTo ?? this.#settings.replyTo,
        tags: request.tags ?? [],
        idempotencyKey: request.idempotencyKey,
      });

      const sent = await this.#repository.markSent(message.id, result.providerId, result.providerStatus);

      this.#logger.info("Email sent", {
        event: "email_sent",
        messageId: sent.id,
        template: template.name,
        to: maskEmail(to),
      });

      return { id: sent.id, status: sent.status, duplicate: false };
    } catch (error) {
      await this.#fail(message, error);

      throw error instanceof ProviderRefusedError
        ? new DeliveryRefusedError(error.status, error.code)
        : new DeliveryUnavailableError(error instanceof ProviderUnavailableError ? error.message : "send failed");
    }
  }

  public async status(id: string): Promise<MessageRecord | undefined> {
    return this.#repository.findById(id);
  }

  /**
   * Verifies the signature over the raw bytes, then records the event once. The signature check runs
   * before anything is parsed, so a forged body never reaches the JSON reader.
   */
  public async handleWebhook(rawBody: Uint8Array, header: HeaderReader): Promise<WebhookResult> {
    const event = this.#provider.parseWebhook(rawBody, header);
    const message =
      event.providerId === undefined ? undefined : await this.#repository.findByProviderId(event.providerId);

    const state = await this.#repository.recordEvent({
      provider: this.#provider.id,
      eventId: event.eventId,
      eventType: event.eventType,
      messageId: message?.id,
      occurredAt: event.occurredAt,
    });

    if (state !== "NEW") {
      return "duplicate";
    }

    const outcome = await this.#apply(event, message);

    await this.#repository.completeEvent(this.#provider.id, event.eventId, outcome);

    return outcome;
  }

  async #apply(event: DeliveryEvent, message: MessageRecord | undefined): Promise<WebhookResult> {
    if (event.outcome === "IGNORED") {
      return "ignored";
    }

    // A bounce or a complaint suppresses the address even when we cannot tie it to a message: the
    // damage to the sending domain is the same either way.
    if ((event.outcome === "BOUNCED" || event.outcome === "COMPLAINED") && event.permanent) {
      const address = event.address ?? message?.toAddress;

      if (address !== undefined) {
        await this.#repository.suppress(
          addressHash(address),
          normaliseAddress(address),
          event.outcome === "COMPLAINED" ? "COMPLAINT" : "BOUNCE",
          `${WEBHOOK_ROUTE}:${event.eventType}`,
        );
      }
    }

    if (message === undefined) {
      return "unknown_message";
    }

    await this.#repository.applyDeliveryStatus(message.id, event.outcome, event.occurredAt);

    return "applied";
  }

  async #fail(message: MessageRecord, error: unknown): Promise<void> {
    const reason =
      error instanceof ProviderRefusedError
        ? `refused:${String(error.status)}${error.code === undefined ? "" : `:${error.code}`}`
        : error instanceof ProviderUnavailableError
          ? "unavailable"
          : "unknown";

    try {
      await this.#repository.markFailed(message.id, reason);
    } catch (failure) {
      this.#logger.warn("An email failure could not be recorded", {
        event: "email_failure_unrecorded",
        messageId: message.id,
        detail: failure instanceof Error ? failure.name : "unknown",
      });
    }

    this.#logger.warn("An email could not be delivered", {
      event: "email_delivery_failed",
      messageId: message.id,
      template: message.template,
      reason,
    });
  }
}
