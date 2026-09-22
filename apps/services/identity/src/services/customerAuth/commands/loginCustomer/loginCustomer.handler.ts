import { CommandHandler } from "@zudojs/cqrs";
import { ACCOUNT_SECURITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import type { CustomerLoginOutcome } from "../../../../dtos/index.js";
import {
  AccountSuspendedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { describeClient, normaliseEmail, randomUrlToken, sha256Hex } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import type { LoginCustomerCommand } from "./loginCustomer.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "sessions" | "throttle" | "messenger">;

/**
 * Reads `customers` only, so admin or cashier credentials match nothing. Account state is disclosed only after the password
 * is proven. With two-factor authentication on, no session is issued here: the answer is a short-lived single-use challenge.
 */
export class LoginCustomerHandler extends CommandHandler<LoginCustomerCommand, CustomerLoginOutcome> {
  public readonly commandType = IDENTITY_COMMAND.LOGIN_CUSTOMER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: LoginCustomerCommand): Promise<CustomerLoginOutcome> {
    const { store, hasher, sessions, throttle, messenger } = this.deps;
    const email = normaliseEmail(command.request.email);
    const key = throttleKey.customer(email);

    await throttle.assertNotLocked(key);

    const customer = await store.customers.findByEmail(email);

    if (customer === undefined) {
      await hasher.verifyAgainstNothing(command.request.password);
    }

    if (customer === undefined || !(await hasher.verify(command.request.password, customer.passwordHash))) {
      await throttle.recordFailure(key);
      throw new InvalidCredentialsError();
    }

    await throttle.clear(key);

    if (customer.status !== "ACTIVE" || customer.deletedAt !== null) {
      throw new AccountSuspendedError();
    }

    if (customer.emailVerifiedAt === null) {
      throw new EmailNotVerifiedError();
    }

    const labels = describeClient(command.userAgent);

    if ((await store.twoFactor.find(customer.id)) !== undefined) {
      const challengeId = randomUrlToken();
      const expiresAt = new Date(Date.now() + ACCOUNT_SECURITY.CHALLENGE_TTL_MS);

      await store.twoFactor.createChallenge({ customerId: customer.id, tokenHash: sha256Hex(challengeId), expiresAt, ...labels });

      const backupCodes = await store.twoFactor.countUnusedBackupCodes(customer.id);

      return {
        twoFactor: {
          challengeId,
          methods: backupCodes > 0 ? ["TOTP", "BACKUP_CODE"] : ["TOTP"],
          expiresAt: expiresAt.toISOString(),
        },
      };
    }

    const known = await store.sessions.seenClient(customer.id, labels, new Date(Date.now() - ACCOUNT_SECURITY.KNOWN_CLIENT_WINDOW_MS));
    const issued = await sessions.issue(store, "CUSTOMER", customer.id, labels);

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
