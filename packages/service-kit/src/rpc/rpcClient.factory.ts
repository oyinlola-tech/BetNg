/**
 * Builds the RPC clients a service uses to call its peers.
 */

import { RPCClient } from "@zudojs/rpc";
import type { ServiceEndpoint } from "../serviceConfig/index.js";
import { createHttpRpcTransport } from "./rpcTransport.http.js";

/** How long an RPC call may run before the client gives up. */
export interface RpcClientOptions {
  /** Overrides the endpoint's own timeout. */
  readonly timeoutMs?: number;
}

/**
 * Creates an RPC client for one peer service.
 *
 * @param endpoint - The peer's address, from configuration.
 * @param options - An optional timeout override.
 * @returns A client whose `call` reaches the peer's `/rpc` endpoint.
 */
export function createRpcClient(
  endpoint: ServiceEndpoint,
  options: RpcClientOptions = {},
): RPCClient {
  const timeoutMs = options.timeoutMs ?? endpoint.timeoutMs;

  return new RPCClient(
    createHttpRpcTransport({
      baseUrl: endpoint.url,
      timeoutMs,
      peer: endpoint.name,
    }),
    { timeout: timeoutMs },
  );
}
