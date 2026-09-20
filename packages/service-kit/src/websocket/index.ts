/**
 * @betng/service-kit/websocket
 *
 * WebSocket support, bound to `@zudojs/adapters`' `WebSocketAdapter`
 * contract.
 *
 * ZudoJS defines the contract and ships no implementation; this is BetNG's,
 * backed by `ws` and attached to the same HTTP listener the service already
 * serves REST on.
 */

export { createWebSocketAdapter } from "./websocketAdapter.ws.js";
export type {
  BetNgWebSocketAdapter,
  WebSocketAdapterOptions,
} from "./websocketAdapter.ws.js";

export type {
  WebSocketAdapter,
  WebSocketReadyState,
  WebSocketSession,
} from "@zudojs/adapters";
