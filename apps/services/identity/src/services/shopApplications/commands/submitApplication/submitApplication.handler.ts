import { randomUUID } from "node:crypto";
import { randomNumericCode } from "@zudojs/crypto";
import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { ShopApplicationReceipt } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  SECURITY,
  SYSTEM_ACTOR,
} from "../../../../constants/index.js";
import { ConflictError, ServiceUnavailableError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail, verificationCodeHash } from "../../../../utils/index.js";
import { applicationReference } from "../../applicationReference.js";
import type { SubmitShopApplicationCommand } from "./submitApplication.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit" | "messenger" | "logger" | "security">;

const LIVE =
  "There is already an application for that address. Check its status with the reference you were sent.";

/**
 * Public. Anyone may apply, so this writes a row and proves the address before a reviewer ever sees it.
 * The reference is returned once and is the applicant's only handle; a status lookup needs the verified
 * address too, so the table cannot be walked.
 */
export class SubmitShopApplicationHandler extends CommandHandler<SubmitShopApplicationCommand, ShopApplicationReceipt> {
  public readonly commandType = IDENTITY_COMMAND.SUBMIT_SHOP_APPLICATION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SubmitShopApplicationCommand): Promise<ShopApplicationReceipt> {
    const { store, audit } = this.deps;
    const { request } = command;
    const applicantEmail = normaliseEmail(request.applicantEmail);

    // An address that already runs a shop, or is waiting to, cannot apply again.
    if ((await store.shopApplications.findLive(applicantEmail)) !== undefined) {
      throw new ConflictError(LIVE);
    }

    const reference = applicationReference();
    const code = await randomNumericCode(SECURITY.VERIFICATION_CODE_DIGITS);
    const verificationId = randomUUID();
    const expiresAt = new Date(Date.now() + SECURITY.VERIFICATION_TTL_MS);

    try {
      await store.transaction(async (repositories) => {
        const application = await repositories.shopApplications.create({
          reference,
          applicantName: request.applicantName.trim(),
          applicantEmail,
          applicantPhone: request.applicantPhone.trim(),
          businessName: request.businessName.trim(),
          rcNumber: request.rcNumber?.trim(),
          address: request.address.trim(),
          city: request.city.trim(),
          state: request.state,
          proposedShopName: request.proposedShopName.trim(),
          note: request.note?.trim(),
        });

        // Hashed and bound to its own row id, exactly as a customer's verification code is.
        await repositories.shopApplicationVerifications.create({
          id: verificationId,
          applicationId: application.id,
          codeHash: verificationCodeHash(verificationId, code),
          expiresAt,
        });

        await audit.write(repositories, {
          actorId: SYSTEM_ACTOR.id,
          actorRole: SYSTEM_ACTOR.role,
          actorName: "Shop application",
          action: AUDIT_ACTION.SHOP_APPLICATION_SUBMITTED,
          entityType: AUDIT_ENTITY.SHOP_APPLICATION,
          entityId: application.id,
          after: { reference, businessName: application.businessName, state: application.state },
          severity: "NOTICE",
          requestId: command.requestId,
        });
      });
    } catch (error) {
      // The partial unique index catches a race the read above could not.
      if (isConflictError(error)) {
        throw new ConflictError(LIVE);
      }

      throw error;
    }

    if (this.deps.security.logVerificationCodes) {
      this.deps.logger.info("Shop application verification code issued", {
        event: "verification_code_issued",
        requestId: command.requestId,
        email: applicantEmail,
        code,
        expiresAt: expiresAt.toISOString(),
      });
    }

    await this.deliver(applicantEmail, request.applicantName.trim(), reference, code, expiresAt, command.requestId);

    return { reference, applicantEmail, verificationRequired: true, expiresAt: expiresAt.toISOString() };
  }

  /** Two messages: the code, and the reference the applicant needs to keep. */
  private async deliver(
    to: string,
    applicantName: string,
    reference: string,
    code: string,
    expiresAt: Date,
    requestId: string,
  ): Promise<void> {
    try {
      await this.deps.messenger.sendCode(to, "verification", code, expiresAt);
    } catch (error) {
      this.deps.logger.warn("Shop application code could not be delivered", {
        event: "verification_delivery_failed",
        requestId,
        error: error instanceof Error ? error.name : "unknown",
      });

      throw new ServiceUnavailableError(
        "Your application was received but the code could not be sent. Ask for a new code in a minute.",
      );
    }

    // Best effort: the applicant already has the reference in the answer.
    await this.deps.messenger
      .sendTemplate({
        to,
        template: "shop_application_received",
        variables: { applicantName, reference },
        idempotencyKey: `shop-application-received-${reference}`,
      })
      .catch(() => {
        this.deps.logger.warn("Shop application receipt could not be delivered", {
          event: "application_receipt_failed",
          requestId,
        });
      });
  }
}
