import { CommandHandler } from "@zudojs/cqrs";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError, ResourceNotFoundError, ServiceUnavailableError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { canReceiveReset, issuePasswordReset } from "../../../customerAuth/passwordReset.helper.js";
import type { AdminSendPasswordResetCommand } from "./sendPasswordReset.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit" | "messenger" | "logger">;

/**
 * Emails the customer the same code the forgot-password flow sends. The operator never sees it: it is neither returned,
 * audited nor logged, and the password only changes if the customer uses the code.
 */
export class AdminSendPasswordResetHandler extends CommandHandler<AdminSendPasswordResetCommand> {
  public readonly commandType = IDENTITY_COMMAND.ADMIN_SEND_PASSWORD_RESET;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: AdminSendPasswordResetCommand): Promise<void> {
    const { store, audit, messenger, logger } = this.deps;
    const { actor, customerId, reason } = command;
    const customer = await store.customers.findById(customerId);

    if (customer === undefined || customer.deletedAt !== null) {
      throw new ResourceNotFoundError("That customer does not exist.");
    }

    if (!canReceiveReset(customer)) {
      throw new ConflictError("Only an active account with a verified email address can be sent a reset code.");
    }

    const issued = await issuePasswordReset(store, customer);

    if (issued === undefined) {
      throw new ConflictError("A reset code was sent to this customer less than a minute ago.");
    }

    try {
      await messenger.sendCode(customer.email, "password_reset", issued.code, issued.expiresAt);
    } catch (error) {
      logger.warn("Operator password reset could not be delivered", {
        event: "password_reset_delivery_failed",
        requestId: actor.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableError("The reset email could not be sent. Try again in a minute.");
    }

    await audit.write(store, {
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: AUDIT_ACTION.CUSTOMER_PASSWORD_RESET_SENT,
      entityType: AUDIT_ENTITY.CUSTOMER,
      entityId: customerId,
      reason,
      severity: "WARNING",
      requestId: actor.requestId,
    });

    void messenger.securityAlert(customerId, { kind: "PASSWORD_RESET_SENT_BY_SUPPORT" });
  }
}
