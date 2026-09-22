import { ErrorCodes } from "@betng/contracts";
import {
  forbidden,
  getRequestId,
  isInternalRequest,
  readActor,
  requireActor,
  requireParam,
  toErrorDetails,
  unprocessableEntity,
} from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import type { AdminActor } from "../interfaces/index.js";
import type { CustomerCaller } from "../services/security/index.js";
import { readBearerToken } from "../utils/index.js";
import { idempotencyKeyValidator, idParamValidator } from "../validators/index.js";

export function uuidParam(context: HttpRouterContext, name: string): string {
  const result = validate(idParamValidator, requireParam(context.params, name));

  if (!result.success) {
    throw unprocessableEntity("The path failed validation.", {
      code: ErrorCodes.VALIDATION_FAILED,
      details: toErrorDetails(result.issues.map((issue) => ({ ...issue, path: [name] }))),
    });
  }

  return result.data;
}

/** The permission is re-checked here even though the gateway checked it: a service never relies on its caller for that. */
export function requireAdmin(context: HttpRouterContext, permission: string): AdminActor {
  const actor = requireActor(context.request, { kind: "ADMIN", permission });

  return {
    id: actor.id,
    role: actor.role,
    name: actor.name === "" ? actor.id : actor.name,
    requestId: getRequestId(context.request),
  };
}

const SESSION_HASH_HEADER = "x-betng-session-hash";
const SESSION_HASH = /^[0-9a-f]{64}$/u;

/**
 * A customer route acts for the holder of the bearer token when the gateway forwarded it, otherwise for the gateway's
 * CUSTOMER actor. Never for an id from the path or body.
 */
export function customerCaller(context: HttpRouterContext): CustomerCaller {
  const token = readBearerToken(context.request);
  const actor = readActor(context.request);

  if (token === undefined && actor !== undefined && actor.kind !== "CUSTOMER") {
    throw forbidden("You do not have permission to do this.", { code: ErrorCodes.FORBIDDEN, expose: true });
  }

  const sessionHash = context.request.getHeader(SESSION_HASH_HEADER);

  return {
    token,
    actorId: actor?.kind === "CUSTOMER" ? actor.id : undefined,
    sessionHash:
      sessionHash !== undefined && SESSION_HASH.test(sessionHash) && isInternalRequest(context.request) ? sessionHash : undefined,
    requestId: getRequestId(context.request),
  };
}

const MAX_USER_AGENT = 512;

export function userAgent(context: HttpRouterContext): string | undefined {
  return context.request.getHeader("user-agent")?.slice(0, MAX_USER_AGENT);
}

export function requireIdempotencyKey(context: HttpRouterContext): string {
  const result = validate(idempotencyKeyValidator, context.request.getHeader("idempotency-key") ?? "");

  if (!result.success) {
    throw unprocessableEntity("Send an Idempotency-Key header (8-120 letters, digits, '.', '_', ':' or '-').", {
      code: ErrorCodes.VALIDATION_FAILED,
      details: [{ path: "idempotency-key", message: "Required." }],
    });
  }

  return result.data;
}
