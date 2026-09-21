import { ErrorCodes } from "@betng/contracts";
import {
  getRequestId,
  requireActor,
  requireParam,
  toErrorDetails,
  unprocessableEntity,
} from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { validate } from "@zudojs/validation";
import type { AdminActor } from "../interfaces/index.js";
import { idParamValidator } from "../validators/index.js";

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
