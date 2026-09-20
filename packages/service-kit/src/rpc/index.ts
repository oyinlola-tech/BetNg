/**
 * @betng/service-kit/rpc
 *
 * RPC over HTTP, built on `@zudojs/rpc`.
 *
 * RPC carries the platform's internal, service-to-service calls: typed
 * procedure names, typed errors that survive the wire, deadlines and retries.
 * It is deliberately not the public API — clients speak REST through the
 * gateway, and nothing forwards to `/rpc`.
 */

export { createHttpRpcTransport, RPC_PATH } from "./rpcTransport.http.js";
export type { HttpRpcTransportOptions } from "./rpcTransport.http.js";

export { registerRpcRoute } from "./rpcRoute.registrar.js";

export { createRpcClient } from "./rpcClient.factory.js";
export type { RpcClientOptions } from "./rpcClient.factory.js";

export {
  createRPCMetadata,
  createRPCProcedure,
  RPCClient,
  RPCError,
  RPCInternalError,
  RPCProcedureNotFoundError,
  RPCServer,
  RPCUnavailableError,
  RPCValidationError,
} from "@zudojs/rpc";
export type {
  RPCContext,
  RPCMetadata,
  RPCProcedure,
  RPCRequest,
  RPCResponse,
  RPCTransport,
} from "@zudojs/rpc";
