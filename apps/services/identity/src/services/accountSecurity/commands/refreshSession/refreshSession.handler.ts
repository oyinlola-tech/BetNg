import { CommandHandler } from "@zudojs/cqrs";
import type { SessionRefresh } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { RefreshSessionCommand } from "./refreshSession.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "sessions">;

/** Slides the expiry forward by one session lifetime, never past the absolute maximum counted from sign-in. */
export class RefreshSessionHandler extends CommandHandler<RefreshSessionCommand, SessionRefresh> {
  public readonly commandType = IDENTITY_COMMAND.REFRESH_SESSION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RefreshSessionCommand): Promise<SessionRefresh> {
    const { store, resolver, sessions } = this.deps;
    const { session } = await resolveCaller(resolver, store, command.caller, { requireSession: true });

    if (session === undefined) {
      throw new Error("A refresh resolved no session.");
    }

    const target = Math.min(Date.now() + sessions.ttlMs("CUSTOMER"), session.createdAt.getTime() + sessions.maxLifetimeMs);

    if (target > session.expiresAt.getTime()) {
      await store.sessions.extend(session.id, new Date(target));
    }

    return { expiresAt: new Date(Math.max(target, session.expiresAt.getTime())).toISOString() };
  }
}
