import { CommandHandler } from "@zudojs/cqrs";
import type { CustomerProfile } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toCustomerProfile } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import { resolveCaller } from "../../../security/index.js";
import { profileChange } from "../../profileChange.helper.js";
import type { UpdateCustomerProfileCommand } from "./updateProfile.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "audit" | "messenger">;

/** The caller's own profile only. A no-op request answers the current profile without an audit entry or an alert. */
export class UpdateCustomerProfileHandler extends CommandHandler<UpdateCustomerProfileCommand, CustomerProfile> {
  public readonly commandType = IDENTITY_COMMAND.UPDATE_CUSTOMER_PROFILE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: UpdateCustomerProfileCommand): Promise<CustomerProfile> {
    const { store, resolver, audit, messenger } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const change = profileChange(customer, command.request);

    if (change === undefined) {
      return toCustomerProfile(customer);
    }

    const updated = await store.transaction(async (repositories) => {
      const next = await repositories.customers.updateProfile(customer.id, change.changes);

      await audit.write(repositories, {
        ...customerAuditActor(customer, command.caller.requestId),
        action: AUDIT_ACTION.CUSTOMER_PROFILE_UPDATED,
        before: change.before,
        after: change.after,
        severity: "NOTICE",
      });

      return next;
    });

    void messenger.securityAlert(customer.id, { kind: "PROFILE_UPDATED", bySupport: false });

    return toCustomerProfile(updated);
  }
}
