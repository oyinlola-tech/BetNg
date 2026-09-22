import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import { ServiceUnavailableError, TooManyAttemptsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import type { ResendVerificationCommand } from "./resendVerification.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "verifications" | "logger">;

export class ResendVerificationHandler extends CommandHandler<ResendVerificationCommand> {
  public readonly commandType = IDENTITY_COMMAND.RESEND_VERIFICATION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ResendVerificationCommand): Promise<void> {
    const { store, verifications } = this.deps;
    const customer = await store.customers.findByEmail(normaliseEmail(command.email));

    if (customer === undefined || customer.emailVerifiedAt !== null) {
      return;
    }

    const latest = await store.verifications.findLatest(customer.id);

    if (
      latest !== undefined &&
      Date.now() - latest.createdAt.getTime() < SECURITY.VERIFICATION_RESEND_INTERVAL_MS
    ) {
      throw new TooManyAttemptsError("A code was sent moments ago. Wait a minute before asking for another.");
    }

    const issued = await store.transaction(async (repositories) =>
      verifications.issue(repositories, customer, command.requestId),
    );

    try {
      await issued.send();
    } catch (error) {
      this.deps.logger.warn("Verification code could not be delivered", {
        event: "verification_delivery_failed",
        requestId: command.requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableError("The code could not be sent. Try again in a minute.");
    }
  }
}
