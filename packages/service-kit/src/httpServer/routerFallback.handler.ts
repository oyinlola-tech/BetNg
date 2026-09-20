/**
 * The router's own 404 and 405 responses.
 *
 * Rendered as the BetNG envelope so a missing route looks like every other
 * failure to a client, correlation identifier included.
 */

import { createResponseContext } from "@zudojs/http";
import type { RouterOptions } from "@zudojs/http";
import { ErrorCodes } from "@betng/contracts";
import { buildErrorBody } from "../httpError/index.js";
import { getRequestId } from "../httpMiddleware/index.js";

/**
 * Builds the router options carrying BetNG's unmatched-route responses.
 *
 * @returns Router options with both fallbacks installed.
 */
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
