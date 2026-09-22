import { CommandHandler } from "@zudojs/cqrs";
import type { AccountDeletion } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toAccountDeletion } from "../../../../dtos/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../accountSecurity.helper.js";
import type { CancelAccountDeletionCommand } from "./cancelAccountDeletion.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "audit">;

export class CancelAccountDeletionHandler extends CommandHandler<CancelAccountDeletionCommand, AccountDeletion> {
  public readonly commandType = IDENTITY_COMMAND.CANCEL_ACCOUNT_DELETION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: CancelAccountDeletionCommand): Promise<AccountDeletion> {
    const { store, resolver, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const latest = await store.deletions.findLatest(customer.id);
    const refused = (): ConflictError => new ConflictError("There is no deletion request to cancel.");

    if (latest?.status !== "PENDING") {
      throw refused();
    }

    const now = new Date();

    await store.transaction(async (repositories) => {
      if (!(await repositories.deletions.cancel(latest.id, now))) {
        throw refused();
      }

      await audit.write(repositories, { ...customerAuditActor(customer, command.caller.requestId), action: AUDIT_ACTION.DELETION_CANCELLED });
    });

    return toAccountDeletion({ ...latest, status: "CANCELLED", cancelledAt: now }, []);
  }
}
