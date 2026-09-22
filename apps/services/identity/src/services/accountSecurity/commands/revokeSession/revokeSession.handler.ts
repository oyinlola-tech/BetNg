import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { RevokeSessionCommand } from "./revokeSession.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "evictor">;

/** Only the caller's own sessions match; the gateway cache entry is evicted before the answer. */
export class RevokeSessionHandler extends CommandHandler<RevokeSessionCommand> {
  public readonly commandType = IDENTITY_COMMAND.REVOKE_SESSION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RevokeSessionCommand): Promise<void> {
    const { store, resolver, evictor } = this.deps;
    const { customer, session } = await resolveCaller(resolver, store, command.caller, { requireSession: true });

    if (command.sessionId === session?.id) {
      throw new ConflictError("This is the session you are using. Sign out instead.");
    }

    if (!(await store.sessions.revokeOwned(command.sessionId, customer.id, new Date()))) {
      throw new ResourceNotFoundError("There is no such session on your account.");
    }

    await evictor.flush();
  }
}
