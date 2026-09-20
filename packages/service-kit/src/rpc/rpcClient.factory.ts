import { RPCClient } from "@zudojs/rpc";
import type { ServiceEndpoint } from "../serviceConfig/index.js";
import { createHttpRpcTransport } from "./rpcTransport.http.js";

export interface RpcClientOptions {
  readonly timeoutMs?: number;
}

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
