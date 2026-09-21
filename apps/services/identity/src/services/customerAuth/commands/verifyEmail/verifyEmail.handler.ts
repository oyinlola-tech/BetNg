import { CommandHandler } from "@zudojs/cqrs";
import type { CustomerSession } from "@betng/contracts";
import { IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import {
  AccountSuspendedError,
  InvalidInputError,
  TooManyAttemptsError,
} from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import {
  constantTimeEqual,
  normaliseEmail,
  verificationCodeHash,
} from "../../../../utils/index.js";
import type { VerifyEmailCommand } from "./verifyEmail.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "sessions" | "security">;

const rejected = (): InvalidInputError =>
  new InvalidInputError("code", "That code is not right or has expired. Check it, or request a new one.");

/**
 * Confirms the six-digit code and opens the customer's first session.
 *
 * Every guess is counted before it is compared, in one conditional update, so
 * parallel guesses cannot exceed the cap. An unknown address, a spent code, an
 * expired code and a wrong code all answer the same way.
 */
export class VerifyEmailHandler extends CommandHandler<VerifyEmailCommand, CustomerSession> {
  public readonly commandType = IDENTITY_COMMAND.VERIFY_EMAIL;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: VerifyEmailCommand): Promise<CustomerSession> {
    const { store, sessions, security } = this.deps;
    const customer = await store.customers.findByEmail(normaliseEmail(command.request.email));

    if (customer === undefined || customer.emailVerifiedAt !== null) {
      throw rejected();
    }

    const verification = await store.verifications.findLatest(customer.id);
    const now = new Date();

    if (verification === undefined || verification.consumedAt !== null || verification.expiresAt <= now) {
      throw rejected();
    }

    if (!(await store.verifications.claimAttempt(verification.id, SECURITY.MAX_VERIFICATION_ATTEMPTS))) {
      throw new TooManyAttemptsError("Too many incorrect codes. Request a new code.");
    }

    const issuedMatches = constantTimeEqual(
      verificationCodeHash(verification.id, command.request.code),
      verification.codeHash,
    );

    const fixedMatches =
      security.devVerificationCode !== undefined &&
      constantTimeEqual(command.request.code, security.devVerificationCode);

    if (!issuedMatches && !fixedMatches) {
      throw rejected();
    }

    if (customer.status !== "ACTIVE") {
      throw new AccountSuspendedError();
    }

    return store.transaction(async (repositories) => {
      if (!(await repositories.verifications.consume(verification.id, now))) {
        throw rejected();
      }

      const verified = await repositories.customers.markVerified(customer.id, now);
      const issued = await sessions.issue(repositories, "CUSTOMER", verified.id);

      return {
        token: issued.token,
        expiresAt: issued.session.expiresAt.toISOString(),
        user: toCustomerProfile(verified),
      };
    });
  }
}
