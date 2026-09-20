/**
 * Request correlation.
 *
 * A request entering the platform is given an identifier: reused from an
 * inbound `x-request-id` when the caller supplied one, freshly generated
 * otherwise. The identifier is stored on the request context, echoed on the
 * response, attached to every log line, and forwarded on outbound calls, so
 * one identifier follows a request across service boundaries.
 *
 * That is deliberately all this is. Spans, sampling and a trace backend are
 * a later concern; the identifier has to exist first for any of them to be
 * useful.
 */

import { REQUEST_ID_HEADER } from "@betng/contracts";
import type { HttpMiddleware, HttpRequestContext } from "@zudojs/http";

/** The key the request identifier is stored under on the request context. */
export const REQUEST_ID_STATE = "betng.requestId";

/**
 * A client-supplied identifier is echoed back and written to logs, so it is
 * bounded and restricted to characters that cannot forge a header or corrupt
 * a log line. Anything else is replaced with a generated identifier.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

/**
 * Returns the correlation identifier the pipeline assigned to a request.
 *
 * @param request - The request context.
 * @returns The correlation identifier.
 */
export function getRequestId(request: HttpRequestContext): string {
  return request.getState<string>(REQUEST_ID_STATE) ?? request.id;
}

/**
 * Assigns the correlation identifier and echoes it on the response.
 *
 * Registered first in the pipeline so every later stage — logging, the
 * error handler, the router — can rely on the identifier being present.
 *
 * @returns The middleware.
 */
export function createRequestIdMiddleware(): HttpMiddleware {
  return async (context, next) => {
    const inbound = context.request.getHeader(REQUEST_ID_HEADER);

    const requestId =
      inbound !== undefined && SAFE_REQUEST_ID.test(inbound)
        ? inbound
        : crypto.randomUUID();

    context.request.setState(REQUEST_ID_STATE, requestId);

    const response = await next();

    response.setHeader(REQUEST_ID_HEADER, requestId);

    return response;
  };
}
