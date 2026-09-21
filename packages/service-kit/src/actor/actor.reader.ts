// The gateway asserts the actor in these headers; they are honoured only with the internal token.

import { forbidden, unauthorized } from "@zudojs/http";
import type { HttpRequestContext } from "@zudojs/http";
import { ErrorCodes } from "@betng/contracts";
import { isInternalRequest } from "../internalAuth/index.js";

export const ACTOR_HEADER_PREFIX = "x-betng-";

export const ACTOR_HEADERS = Object.freeze({
  kind: "x-betng-actor-kind",
  id: "x-betng-actor-id",
  role: "x-betng-actor-role",
  name: "x-betng-actor-name",
  shopId: "x-betng-shop-id",
  permissions: "x-betng-permissions",
});

export type ActorKind = "CUSTOMER" | "CASHIER" | "ADMIN";

export interface Actor {
  readonly kind: ActorKind;
  readonly id: string;
  readonly role: string;
  readonly name: string;
  readonly shopId?: string;
  readonly permissions: readonly string[];
}

const KINDS: readonly string[] = ["CUSTOMER", "CASHIER", "ADMIN"];

export function readActor(request: HttpRequestContext): Actor | undefined {
  if (!isInternalRequest(request)) return undefined;

  const kind = request.getHeader(ACTOR_HEADERS.kind);
  const id = request.getHeader(ACTOR_HEADERS.id);

  if (kind === undefined || id === undefined || !KINDS.includes(kind)) {
    return undefined;
  }

  const shopId = request.getHeader(ACTOR_HEADERS.shopId);
  const permissions = request.getHeader(ACTOR_HEADERS.permissions) ?? "";

  return {
    kind: kind as ActorKind,
    id,
    role: request.getHeader(ACTOR_HEADERS.role) ?? "",
    name: decodeURIComponent(request.getHeader(ACTOR_HEADERS.name) ?? ""),
    ...(shopId === undefined || shopId === "" ? {} : { shopId }),
    permissions: permissions.split(",").filter((entry) => entry !== ""),
  };
}

export interface ActorRequirement {
  readonly kind?: ActorKind | readonly ActorKind[];
  readonly permission?: string;
}

export function requireActor(
  request: HttpRequestContext,
  requirement: ActorRequirement = {},
): Actor {
  const actor = readActor(request);

  if (actor === undefined) {
    throw unauthorized("Sign in to continue.", {
      code: ErrorCodes.UNAUTHENTICATED,
      expose: true,
    });
  }

  const kinds =
    requirement.kind === undefined
      ? undefined
      : typeof requirement.kind === "string"
        ? [requirement.kind]
        : requirement.kind;

  const allowed =
    (kinds === undefined || kinds.includes(actor.kind)) &&
    (requirement.permission === undefined ||
      actor.permissions.includes(requirement.permission));

  if (!allowed) {
    throw forbidden("You do not have permission to do this.", {
      code: ErrorCodes.FORBIDDEN,
      expose: true,
    });
  }

  return actor;
}

/** The display name is URI-encoded: header values are ASCII. */
export function actorHeaders(actor: Actor): Record<string, string> {
  return {
    [ACTOR_HEADERS.kind]: actor.kind,
    [ACTOR_HEADERS.id]: actor.id,
    [ACTOR_HEADERS.role]: actor.role,
    [ACTOR_HEADERS.name]: encodeURIComponent(actor.name),
    ...(actor.shopId === undefined ? {} : { [ACTOR_HEADERS.shopId]: actor.shopId }),
    [ACTOR_HEADERS.permissions]: actor.permissions.join(","),
  };
}
