import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { RegistrationPending } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError, InvalidInputError, ServiceUnavailableError } from "../../../../errors/index.js";
import type { HandlerDependencies, IssuedVerification } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import type { RegisterCustomerCommand } from "./registerCustomer.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "verifications" | "logger" | "breachChecker">;

const TAKEN = "An account with that email already exists. Log in instead.";

/**
 * A registered address is refused, verified or not, so a second registration can never replace the first one's password.
 * Exception: a registration whose code lapsed unused is released. An admin's address is refused too (invariant 9).
 */
export class RegisterCustomerHandler extends CommandHandler<RegisterCustomerCommand, RegistrationPending> {
  public readonly commandType = IDENTITY_COMMAND.REGISTER_CUSTOMER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RegisterCustomerCommand): Promise<RegistrationPending> {
    const { store, hasher, verifications } = this.deps;
    const email = normaliseEmail(command.request.email);
    const phone = command.request.phone?.trim();

    // Checked and hashed before any lookup, so the answer takes as long whether or not the address is taken.
    if (await this.deps.breachChecker.isBreached(command.request.password)) {
      throw new InvalidInputError("password", "This password has appeared in a data breach. Choose a different one.");
    }

    const passwordHash = await hasher.hash(command.request.password);

    const [existing, admin] = await Promise.all([
      store.customers.findByEmail(email),
      store.admins.findByEmail(email),
    ]);

    if (admin !== undefined) {
      throw new ConflictError(TAKEN);
    }

    if (existing !== undefined) {
      const latest = await store.verifications.findLatest(existing.id);
      const pending = latest !== undefined && latest.consumedAt === null && latest.expiresAt > new Date();

      if (existing.emailVerifiedAt !== null || pending) {
        throw new ConflictError(TAKEN);
      }
    }

    try {
      const issued = await store.transaction(async (repositories) => {
        if (existing !== undefined) {
          await repositories.customers.remove(existing.id);
        }

        const customer = await repositories.customers.create({
          email,
          displayName: command.request.displayName.trim(),
          phone: phone === undefined || phone === "" ? undefined : phone,
          passwordHash,
        });

        return verifications.issue(repositories, customer, command.requestId);
      });

      await this.deliver(issued, command.requestId);

      return { email, verificationRequired: true, expiresAt: issued.expiresAt.toISOString() };
    } catch (error) {
      if (isConflictError(error)) {
        throw new ConflictError(TAKEN);
      }

      throw error;
    }
  }

  /** The account exists either way; the caller learns the truth about the email and can ask for the code again. */
  private async deliver(issued: IssuedVerification, requestId: string): Promise<void> {
    try {
      await issued.send();
    } catch (error) {
      this.deps.logger.warn("Verification code could not be delivered", {
        event: "verification_delivery_failed",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ServiceUnavailableError("Your account was created but the code could not be sent. Ask for a new code in a minute.");
    }
  }
}
