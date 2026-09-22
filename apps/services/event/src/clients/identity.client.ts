import { ErrorCodes } from "@betng/contracts";
import type { Actor, ActorKind } from "@betng/service-kit";
import { createRPCMetadata, isRPCError } from "@zudojs/rpc";
import type { RPCClient } from "@zudojs/rpc";

export interface ResolvedSession {
  readonly actor: Actor;
  readonly expiresAt: number;
}

export type AuthOutcome =
  | { readonly ok: true; readonly session: ResolvedSession }
  | { readonly ok: false; readonly reason: "UNAUTHENTICATED" | "SESSION_EXPIRED" | "UNAVAILABLE" };

export interface SessionAuthenticator {
  authenticate(token: string, requestId: string): Promise<AuthOutcome>;
}

const KINDS: readonly string[] = ["CUSTOMER", "CASHIER", "ADMIN"];
const REFUSED: readonly string[] = [
  ErrorCodes.UNAUTHENTICATED,
  ErrorCodes.FORBIDDEN,
  "ERR_RPC_UNAUTHORIZED",
  "ERR_RPC_FORBIDDEN",
];

function toSession(value: unknown): ResolvedSession | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const result = value as Record<string, unknown>;
  const expiresAt = typeof result["expiresAt"] === "string" ? Date.parse(result["expiresAt"]) : Number.NaN;
  const permissions = result["permissions"];

  if (
    typeof result["kind"] !== "string" ||
    !KINDS.includes(result["kind"]) ||
    typeof result["id"] !== "string" ||
    !Array.isArray(permissions) ||
    !permissions.every((entry) => typeof entry === "string") ||
    Number.isNaN(expiresAt)
  ) {
    return undefined;
  }

  const shopId = result["shopId"];

  return {
    actor: {
      kind: result["kind"] as ActorKind,
      id: result["id"],
      role: typeof result["role"] === "string" ? result["role"] : "",
      name: typeof result["name"] === "string" ? result["name"] : "",
      ...(typeof shopId === "string" ? { shopId } : {}),
      permissions,
    },
    expiresAt,
  };
}

export function createIdentityAuthenticator(client: RPCClient): SessionAuthenticator {
  return {
    authenticate: async (token, requestId) => {
      try {
        const session = toSession(
          await client.call<{ token: string }, unknown>(
            "identity.authenticate",
            { token },
            { metadata: createRPCMetadata({ requestId }) },
          ),
        );

        return session === undefined ? { ok: false, reason: "UNAVAILABLE" } : { ok: true, session };
      } catch (error) {
        const code = isRPCError(error) ? String(error.code) : undefined;

        if (code === ErrorCodes.SESSION_EXPIRED) return { ok: false, reason: "SESSION_EXPIRED" };
        if (code !== undefined && REFUSED.includes(code)) return { ok: false, reason: "UNAUTHENTICATED" };

        return { ok: false, reason: "UNAVAILABLE" };
      }
    },
  };
}
