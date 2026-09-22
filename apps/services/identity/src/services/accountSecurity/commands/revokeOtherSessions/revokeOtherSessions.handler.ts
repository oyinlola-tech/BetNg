import { CommandHandler } from "@zudojs/cqrs";
import { AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../accountSecurity.helper.js";
import type { RevokeOtherSessionsCommand } from "./revokeOtherSessions.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "audit" | "evictor">;

export class RevokeOtherSessionsHandler extends CommandHandler<RevokeOtherSessionsCommand> {
  public readonly commandType = IDENTITY_COMMAND.REVOKE_OTHER_SESSIONS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RevokeOtherSessionsCommand): Promise<void> {
    const { store, resolver, audit, evictor } = this.deps;
    const { customer, session } = await resolveCaller(resolver, store, command.caller, { requireSession: true });

    await store.transaction(async (repositories) => {
      const revoked = await repositories.sessions.revokeOthers(customer.id, session?.id, new Date());

      if (revoked > 0) {
        await audit.write(repositories, {
          ...customerAuditActor(customer, command.caller.requestId),
          action: AUDIT_ACTION.SESSIONS_REVOKED,
          after: { revoked },
        });
      }
    });

    await evictor.flush();
  }
}
