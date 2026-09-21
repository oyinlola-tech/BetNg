import { setTimeout as delay } from "node:timers/promises";
import { CommandHandler } from "@zudojs/cqrs";
import { randomToken } from "@zudojs/crypto";
import { IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail, sha256Hex } from "../../../../utils/index.js";
import type { RequestPasswordResetCommand } from "./requestPasswordReset.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "logger">;

/**
 * Records a password-reset request.
 *
 * The answer is always the same and always takes `PASSWORD_RESET_RESPONSE_MS`,
 * far longer than the work, so neither the body nor the clock says whether the
 * address has an account. A failure is logged, never surfaced, for the same
 * reason. The token's hash is stored and the token is discarded: there is no
 * mail server to carry it, and no route here accepts one.
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
      await this.record(normaliseEmail(command.email));
    } catch (error) {
      this.deps.logger.error("Password reset request could not be recorded", {
        event: "password_reset_failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await floor;
  }

  private async record(email: string): Promise<void> {
    const { store } = this.deps;
    const tokenHash = sha256Hex(await randomToken(SECURITY.SESSION_TOKEN_BYTES));
    const customer = await store.customers.findByEmail(email);

    if (customer === undefined || customer.status !== "ACTIVE" || customer.emailVerifiedAt === null) {
      return;
    }

    await store.transaction(async (repositories) =>
      repositories.passwordResets.replace(
        customer.id,
        tokenHash,
        new Date(Date.now() + SECURITY.PASSWORD_RESET_TTL_MS),
      ),
    );
  }
}
