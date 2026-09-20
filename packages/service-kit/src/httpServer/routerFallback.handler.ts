import { createResponseContext } from "@zudojs/http";
import type { RouterOptions } from "@zudojs/http";
import { ErrorCodes } from "@betng/contracts";
import { buildErrorBody } from "../httpError/index.js";
import { getRequestId } from "../httpMiddleware/index.js";

export function createRouterFallbacks(): RouterOptions {
  return {
    notFoundHandler: (context) =>
      createResponseContext({ status: 404 }).json(
        buildErrorBody({
          code: ErrorCodes.NOT_FOUND,
          message: `No route matches ${context.method} ${context.path}.`,
          requestId: getRequestId(context.request),
        }),
      ),

    methodNotAllowedHandler: (context, allowed) =>
      createResponseContext({ status: 405 })
        .setHeader("allow", allowed.join(", "))
        .json(
          buildErrorBody({
            code: ErrorCodes.METHOD_NOT_ALLOWED,
            message:
              `${context.method} is not allowed on ${context.path}. ` +
              `Allowed: ${allowed.join(", ")}.`,
            requestId: getRequestId(context.request),
          }),
        ),
  };
}
