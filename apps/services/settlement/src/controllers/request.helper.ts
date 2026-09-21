import { ErrorCodes } from "@betng/contracts";
import {
  getRequestId,
  requireParam,
  toErrorDetails,
  unprocessableEntity,
} from "@betng/service-kit";
import type { Actor, HttpRouterContext } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import type { AuditActor } from "../interfaces/index.js";

export function parseParam<T>(context: HttpRouterContext, name: string, schema: ValidationSchema<T>): T {
  const result = validate(schema, requireParam(context.params, name), { pathPrefix: [name] });

  if (result.success) {
    return result.data;
  }

  throw unprocessableEntity("The path failed validation.", {
    code: ErrorCodes.VALIDATION_FAILED,
    details: toErrorDetails(result.issues),
  });
}

export function toAuditActor(actor: Actor, context: HttpRouterContext): AuditActor {
  return {
    actorId: actor.id,
    actorRole: actor.role === "" ? actor.kind : actor.role,
    requestId: getRequestId(context.request),
  };
}
