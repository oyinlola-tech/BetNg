/**
 * Mounts an `RPCServer` on a service's HTTP router.
 *
 * Every BetNG service serves its RPC procedures at `POST /rpc`, on the same
 * listener as its REST API. One process, one port, one thing to health-check.
 *
 * The endpoint is internal. It sits outside `/api/v1` precisely because it is
 * not part of the public API: the gateway does not forward to it, and
 * `docs/api/rpc.md` records which services may call which procedures. A
 * deployment keeps it off the public network the same way it keeps the
 * services themselves off it.
 */

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
): void {
  router.post(RPC_PATH, async (context) => {
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
