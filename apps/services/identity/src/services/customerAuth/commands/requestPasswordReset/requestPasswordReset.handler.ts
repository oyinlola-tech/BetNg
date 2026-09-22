import { setTimeout as delay } from "node:timers/promises";
import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import { canReceiveReset, issuePasswordReset } from "../../passwordReset.helper.js";
import type { RequestPasswordResetCommand } from "./requestPasswordReset.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "logger" | "messenger" | "security">;

/**
 * Same answer and same duration whether or not the address exists. The code is emailed after the answer's timing floor is
 * already fixed, and delivery failures are logged, never surfaced, for the same reason.
 */
export class RequestPasswordResetHandler extends CommandHandler<RequestPasswordResetCommand> {
  public readonly commandType = IDENTITY_COMMAND.REQUEST_PASSWORD_RESET;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RequestPasswordResetCommand): Promise<void> {
    const floor = delay(SECURITY.PASSWORD_RESET_RESPONSE_MS);

    try {
      const send = await this.record(normaliseEmail(command.email), command.requestId);

      if (send !== undefined) {
        void send().catch((error: unknown) => {
          this.deps.logger.warn("Password reset code could not be delivered", {
            event: "password_reset_delivery_failed",
            requestId: command.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      this.deps.logger.error("Password reset request could not be recorded", {
        event: "password_reset_failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await floor;
  }

  private async record(email: string, requestId: string): Promise<(() => Promise<void>) | undefined> {
    const { store, messenger, security, logger } = this.deps;
    const customer = await store.customers.findByEmail(email);

    if (customer === undefined || !canReceiveReset(customer)) {
      return undefined;
    }

    const issued = await issuePasswordReset(store, customer);

    if (issued === undefined) {
      return undefined;
    }

    const { code, expiresAt } = issued;

    if (security.logVerificationCodes) {
      logger.info("Password reset code issued", { event: "password_reset_code_issued", requestId, email: customer.email, code });
    }

    return async () => messenger.sendCode(customer.email, "password_reset", code, expiresAt);
  }
}
