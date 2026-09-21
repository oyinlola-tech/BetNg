import {
  getRequestId,
  readJsonBody,
  requireActor,
} from "@betng/service-kit";
import type {
  Actor,
  ActorRequirement,
  HttpRequestContext,
} from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import { IDEMPOTENCY_KEY_HEADER, MAX_LEGS } from "../constants/index.js";
import {
  actorNotAllowed,
  invalidBet,
  invalidRequest,
} from "../errors/index.js";
import type { CounterActor } from "../services/ticket/commands/index.js";
import { idempotencyKeyValidator, uuidValidator } from "../validators/index.js";

// Actor ids are bound into SQL and sent to peers, so they must be UUIDs.
export function requireValidActor(
  request: HttpRequestContext,
  requirement: ActorRequirement,
): Actor {
  const actor = requireActor(request, requirement);

  if (
    !validate(uuidValidator, actor.id).success ||
    (actor.shopId !== undefined && !validate(uuidValidator, actor.shopId).success)
  ) {
    throw actorNotAllowed("The caller could not be identified.");
  }

  return actor;
}

export function requireCounter(
  request: HttpRequestContext,
  permission: string,
): CounterActor {
  const actor = requireValidActor(request, { kind: "CASHIER", permission });

  if (actor.shopId === undefined) {
    throw actorNotAllowed("This cashier is not attached to a shop.");
  }

  return { cashierId: actor.id, role: actor.role, shopId: actor.shopId };
}

export function readIdempotencyKey(request: HttpRequestContext): string {
  const supplied = request.getHeader(IDEMPOTENCY_KEY_HEADER);

  if (supplied === undefined || supplied === "") {
    return crypto.randomUUID();
  }

  const key = validate(idempotencyKeyValidator, supplied);

  if (!key.success) {
    throw invalidRequest(
      "The idempotency key must be 8 to 120 letters, digits or . _ : -",
    );
  }

  return key.data;
}

// More than MAX_LEGS answers INVALID_BET rather than the schema's VALIDATION_FAILED.
export function assertLegCount(request: HttpRequestContext): void {
  const body = readJsonBody(request);
  const selections =
    typeof body === "object" && body !== null
      ? (body as { selections?: unknown }).selections
      : undefined;

  if (Array.isArray(selections) && selections.length > MAX_LEGS) {
    throw invalidBet(
      `A slip carries between 1 and ${String(MAX_LEGS)} selections.`,
    );
  }
}

export { getRequestId };
