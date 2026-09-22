import type { Customer, Session } from "../../generated/prisma/client.js";
import { UnauthenticatedError } from "../../errors/index.js";
import type { IdentityStore, SessionResolver } from "../../interfaces/index.js";

/**
 * Who is calling a customer route: the bearer token when the gateway forwarded it (token routes), otherwise the gateway's
 * CUSTOMER actor, with `sessionHash` (sha256 of the bearer, sent by the gateway on /account routes) naming its session.
 */
export interface CustomerCaller {
  readonly token: string | undefined;
  readonly actorId: string | undefined;
  readonly sessionHash?: string | undefined;
  readonly requestId: string;
}

export interface CallingCustomer {
  readonly customer: Customer;
  /** Present only when the caller's session is known; routes that act on "this session" require it. */
  readonly session: Session | undefined;
}

export async function resolveCaller(
  resolver: SessionResolver,
  store: IdentityStore,
  caller: CustomerCaller,
  options: { readonly requireSession?: boolean } = {},
): Promise<CallingCustomer> {
  if (caller.token !== undefined) {
    const resolved = await resolver.resolveAs(caller.token, "CUSTOMER");

    return { customer: resolved.customer, session: resolved.session };
  }

  if (caller.actorId === undefined) {
    throw new UnauthenticatedError();
  }

  const customer = await store.customers.findById(caller.actorId);

  if (customer === undefined || customer.deletedAt !== null || customer.status !== "ACTIVE") {
    throw new UnauthenticatedError();
  }

  let session: Session | undefined;

  if (caller.sessionHash !== undefined) {
    session = await store.sessions.findByTokenHash(caller.sessionHash);

    // A named session that is not this customer's live one means the actor and the session disagree: refuse.
    if (
      session === undefined ||
      session.kind !== "CUSTOMER" ||
      session.subjectId !== customer.id ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthenticatedError();
    }
  }

  if (options.requireSession === true && session === undefined) {
    throw new UnauthenticatedError();
  }

  return { customer, session };
}
