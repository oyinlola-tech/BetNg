import { CommandHandler } from "@zudojs/cqrs";
import type { CustomerSession } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import {
  AccountSuspendedError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { normaliseEmail } from "../../../../utils/index.js";
import { throttleKey } from "../../../security/index.js";
import type { LoginCustomerCommand } from "./loginCustomer.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "sessions" | "throttle">;

/** Reads `customers` only, so admin or cashier credentials match nothing. Account state is disclosed only after the password is proven. */
export class LoginCustomerHandler extends CommandHandler<LoginCustomerCommand, CustomerSession> {
  public readonly commandType = IDENTITY_COMMAND.LOGIN_CUSTOMER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: LoginCustomerCommand): Promise<CustomerSession> {
    const { store, hasher, sessions, throttle } = this.deps;
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

    if (customer.status !== "ACTIVE") {
      throw new AccountSuspendedError();
    }

    if (customer.emailVerifiedAt === null) {
      throw new EmailNotVerifiedError();
    }

    const issued = await sessions.issue(store, "CUSTOMER", customer.id);

    return {
      token: issued.token,
      expiresAt: issued.session.expiresAt.toISOString(),
      user: toCustomerProfile(customer),
    };
  }
}
