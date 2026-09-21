import { REQUEST_ID_HEADER } from "@betng/contracts";
import type { HttpMiddleware, HttpRequestContext } from "@zudojs/http";

export const REQUEST_ID_STATE = "betng.requestId";

/**
 * A client-supplied identifier is echoed back and written to logs, so it is
 * bounded and restricted to characters that cannot forge a header or corrupt
 * a log line. Anything else is replaced with a generated identifier.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

export function getRequestId(request: HttpRequestContext): string {
  return request.getState<string>(REQUEST_ID_STATE) ?? request.id;
}

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
