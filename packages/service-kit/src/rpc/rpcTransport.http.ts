/**
 * The HTTP transport for `@zudojs/rpc`.
 *
 * `@zudojs/rpc` is transport-agnostic and ships no transport of its own —
 * its documentation is explicit that writing one is a dozen lines and that
 * keeping the network out of the RPC layer is the point. This is that dozen
 * lines for BetNG: one `RPCRequest` envelope posted to the peer's `/rpc`
 * endpoint, one `RPCResponse` back.
 *
 * HTTP was chosen over a raw socket because every BetNG service already
 * serves HTTP, so RPC needs no second listener, no second port and no second
 * thing to health-check — and the Python services can speak the same
 * envelope without a protobuf toolchain.
 */

import { internalHeaders } from "../internalAuth/index.js";
import { REQUEST_ID_HEADER } from "@betng/contracts";
import {
  RPCTransportError,
  RPCUnavailableError,
  type RPCRequest,
  type RPCResponse,
  type RPCTransport,
  type RPCTransportRequestOptions,
} from "@zudojs/rpc";

export const RPC_PATH = "/rpc";

export interface HttpRpcTransportOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly peer: string;
}

function isRpcResponse(value: unknown): value is RPCResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as RPCResponse).id === "string" &&
    typeof (value as RPCResponse).success === "boolean"
  );
}

/**
 * Creates a transport that carries RPC over HTTP.
 *
 * The request's `metadata.requestId` is mirrored into the `x-request-id`
 * header so a peer's HTTP access log carries the same correlation
 * identifier as the RPC frame, and one request stays followable whether it
 * crossed the boundary by REST or by RPC.
 */
export function createHttpRpcTransport(
  options: HttpRpcTransportOptions,
): RPCTransport {
  const url = new URL(RPC_PATH, options.baseUrl);

  return {
    async send(
      request: RPCRequest,
      requestOptions?: RPCTransportRequestOptions,
    ): Promise<RPCResponse> {
      const controller = new AbortController();

      const timer = setTimeout(
        () => {
          controller.abort();
        },
        requestOptions?.timeout ?? options.timeoutMs,
      );

      requestOptions?.signal?.addEventListener("abort", () => {
        controller.abort();
      });

      const correlationId = request.metadata.requestId;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            ...internalHeaders(),
            ...(typeof correlationId === "string"
              ? { [REQUEST_ID_HEADER]: correlationId }
              : {}),
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new RPCTransportError(
            `The ${options.peer} service answered ${RPC_PATH} with ` +
              `${String(response.status)}.`,
            request.procedure,
          );
        }

        const body: unknown = await response.json();

        if (!isRpcResponse(body)) {
          throw new RPCTransportError(
            `The ${options.peer} service returned a body that is not an ` +
              `RPC response.`,
            request.procedure,
          );
        }

        return body;
      } catch (error) {
        if (error instanceof RPCTransportError) {
          throw error;
        }

        // A peer that is down or slow is a different problem from a peer
        // that answered badly, and a caller can retry one but not the other.
        throw new RPCUnavailableError(
          error instanceof Error && error.name === "AbortError"
            ? `The ${options.peer} service did not answer within ` +
              `${String(options.timeoutMs)}ms.`
            : `The ${options.peer} service could not be reached.`,
          request.procedure,
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
