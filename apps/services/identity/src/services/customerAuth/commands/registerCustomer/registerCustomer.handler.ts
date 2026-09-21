import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { RegistrationPending } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import type { RegisterCustomerCommand } from "./registerCustomer.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "verifications">;

const TAKEN = "An account with that email already exists. Log in instead.";

/**
 * Creates an unverified customer and issues a verification code. No session
 * starts here; `verifyEmail` opens the first one.
 *
 * An address already registered is refused, verified or not, so a second
 * registration can never replace the password the first one chose. The one
 * exception is a registration whose code lapsed unused: nobody proved they own
 * the address, so it is released and the new registration takes it. An admin's
 * address is refused the same way: an admin is never a customer.
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

    // Hashed before any lookup, so the answer takes as long whether or not the address is taken.
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

      return { email, verificationRequired: true, expiresAt: issued.expiresAt.toISOString() };
    } catch (error) {
      if (isConflictError(error)) {
        throw new ConflictError(TAKEN);
      }

      throw error;
    }
  }
}
