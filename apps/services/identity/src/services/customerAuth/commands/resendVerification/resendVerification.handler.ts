import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import { TooManyAttemptsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import type { ResendVerificationCommand } from "./resendVerification.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "verifications">;

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

    await store.transaction(async (repositories) =>
      verifications.issue(repositories, customer, command.requestId),
    );
  }
}
