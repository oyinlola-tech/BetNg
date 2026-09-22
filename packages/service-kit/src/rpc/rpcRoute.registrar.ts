import { createResponseContext } from "@zudojs/http";
import type { HttpRouter } from "@zudojs/http";
import type { Logger } from "@zudojs/logger";
import {
  createRPCErrorResponse,
  type RPCRequest,
  type RPCServer,
} from "@zudojs/rpc";
import { readJsonBody } from "../httpRequest/index.js";
import { getRequestId } from "../httpMiddleware/index.js";
import { CALLER_HEADER, isInternalRequest } from "../internalAuth/index.js";
import { callerName } from "./rpcRateLimit.js";
import type { CallerRateLimiter } from "./rpcRateLimit.js";
import { RPC_PATH } from "./rpcTransport.http.js";

function isRpcRequest(value: unknown): value is RPCRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RPCRequest>;

  return (
    typeof candidate.id === "string" && typeof candidate.procedure === "string"
  );
}

/**
 * Registers `POST /rpc` on a router.
 *
 * `RPCServer.handle` maps every failure to a typed wire code and never lets
 * internal detail escape, so this returns 200 with the RPC envelope even for
 * a failed call — the transport succeeded, the procedure did not. The only
 * non-200 here is a frame that is not an RPC request at all.
 */
export function registerRpcRoute(
  router: HttpRouter,
  server: RPCServer,
  logger: Logger,
  limiter?: CallerRateLimiter,
): void {
  router.post(RPC_PATH, async (context) => {
    if (!isInternalRequest(context.request)) {
      return createResponseContext({ status: 404 }).json(
        createRPCErrorResponse("", {
          code: "RPC_INVALID_REQUEST",
          message: "Not found.",
        }),
      );
    }

    const caller = callerName(context.request.getHeader(CALLER_HEADER));
    const wait = limiter?.acquire(caller) ?? 0;

    if (wait > 0) {
      logger.warn("RPC caller rate limited", { requestId: getRequestId(context.request), caller });

      return createResponseContext({ status: 429 })
        .setHeader("retry-after", String(Math.max(1, Math.ceil(wait))))
        .json(createRPCErrorResponse("", { code: "RPC_RATE_LIMITED", message: "Too many RPC calls from this service." }));
    }

    const frame = readJsonBody(context.request);

    if (!isRpcRequest(frame)) {
      return createResponseContext({ status: 400 }).json(
        createRPCErrorResponse("", {
          code: "RPC_INVALID_REQUEST",
          message: "The body is not an RPC request frame.",
        }),
      );
    }

    const response = await server.handle(frame);

    if (!response.success) {
      logger.warn("RPC call failed", {
        requestId: getRequestId(context.request),
        procedure: frame.procedure,
        code: response.error?.code,
      });
    }

    return createResponseContext({ status: 200 }).json(response);
  });
}
