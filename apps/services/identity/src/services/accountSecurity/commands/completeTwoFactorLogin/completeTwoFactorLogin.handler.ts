import { CommandHandler } from "@zudojs/cqrs";
import type { CustomerSession } from "@betng/contracts";
import { ACCOUNT_SECURITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import { AccountSuspendedError, InvalidInputError, TooManyAttemptsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { sha256Hex } from "../../../../utils/index.js";
import { throttleKey, verifySecondFactor } from "../../../security/index.js";
import { codeRejected, RejectedCode } from "../../accountSecurity.helper.js";
import type { CompleteTwoFactorLoginCommand } from "./completeTwoFactorLogin.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "sessions" | "throttle" | "protector" | "messenger">;

const expired = (): InvalidInputError => new InvalidInputError("challengeId", "This sign-in has expired. Sign in again.");

/**
 * The challenge is single-use and attempt-limited; failures also count against a per-customer lock, so fresh challenges
 * cannot be used to keep guessing. The code, the challenge and the session commit together or not at all.
 */
export class CompleteTwoFactorLoginHandler extends CommandHandler<CompleteTwoFactorLoginCommand, CustomerSession> {
  public readonly commandType = IDENTITY_COMMAND.COMPLETE_TWO_FACTOR_LOGIN;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CompleteTwoFactorLoginCommand): Promise<CustomerSession> {
    const { store, sessions, throttle, protector, messenger } = this.deps;
    const now = new Date();
    const challenge = await store.twoFactor.findChallenge(sha256Hex(command.request.challengeId));

    if (challenge === undefined || challenge.consumedAt !== null || challenge.expiresAt <= now) {
      throw expired();
    }

    const key = throttleKey.secondFactor(challenge.customerId);

    await throttle.assertNotLocked(key);

    if (!(await store.twoFactor.claimChallengeAttempt(challenge.id, ACCOUNT_SECURITY.MAX_CHALLENGE_ATTEMPTS))) {
      throw new TooManyAttemptsError("Too many incorrect codes. Sign in again.");
    }

    const customer = await store.customers.findById(challenge.customerId);

    if (customer === undefined || customer.status !== "ACTIVE" || customer.deletedAt !== null) {
      throw new AccountSuspendedError();
    }

    const labels = {
      device: challenge.device ?? undefined,
      browser: challenge.browser ?? undefined,
      platform: challenge.platform ?? undefined,
    };
    const known = await store.sessions.seenClient(customer.id, labels, new Date(now.getTime() - ACCOUNT_SECURITY.KNOWN_CLIENT_WINDOW_MS));
    let issued;

    try {
      issued = await store.transaction(async (repositories) => {
        if ((await verifySecondFactor(repositories, protector, customer.id, command.request.code)) === undefined) {
          throw new RejectedCode();
        }

        if (!(await repositories.twoFactor.consumeChallenge(challenge.id, now))) {
          throw new RejectedCode();
        }

        return sessions.issue(repositories, "CUSTOMER", customer.id, labels);
      });
    } catch (error) {
      if (error instanceof RejectedCode) {
        await throttle.recordFailure(key);
        throw codeRejected();
      }

      throw error;
    }

    await throttle.clear(key);

    if (!known) {
      void messenger.securityAlert(customer.id, { kind: "NEW_LOGIN", ...labels });
    }

    return {
      token: issued.token,
      expiresAt: issued.session.expiresAt.toISOString(),
      user: toCustomerProfile(customer),
    };
  }
}
