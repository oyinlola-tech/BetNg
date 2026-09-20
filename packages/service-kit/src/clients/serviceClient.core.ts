/**
 * The service-to-service HTTP client.
 *
 * BetNG services talk to each other over the same REST API a client would
 * use; there is no private back channel. This client exists to make three
 * things automatic: the base URL comes from configuration rather than a
 * literal, the correlation identifier is forwarded, and a slow peer is
 * abandoned rather than allowed to hold a request open indefinitely.
 *
 * An unreachable or slow peer becomes a 503 carrying
 * `UPSTREAM_UNAVAILABLE`, so a caller never has to interpret a raw `fetch`
 * failure.
 */

import { ErrorCodes, REQUEST_ID_HEADER } from "@betng/contracts";
import { HttpError, serviceUnavailable } from "@zudojs/http";
import type { ServiceEndpoint } from "../serviceConfig/index.js";

export interface ServiceResponse<T> {
  readonly status: number;
  readonly data: T;
}

export interface ServiceRequest {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to the peer's root, such as `/api/v1/matches`. */
  readonly path: string;
  readonly body?: unknown;
  /** The correlation identifier to forward. */
  readonly requestId: string;
}

export interface ServiceClient {
  readonly endpoint: ServiceEndpoint;
  readonly request: <T>(options: ServiceRequest) => Promise<ServiceResponse<T>>;
  /** Calls the peer's `/health`, for use as a readiness probe. */
  readonly health: (signal?: AbortSignal) => Promise<void>;
}

function describeFailure(error: unknown, timeoutMs: number): string {
  return error instanceof Error && error.name === "AbortError"
    ? `did not respond within ${String(timeoutMs)}ms`
    : "could not be reached";
}

/**
 * Creates a client for one peer service.
 *
 * @param endpoint - The peer's address and call timeout.
 * @returns The client.
 */
export function createServiceClient(endpoint: ServiceEndpoint): ServiceClient {
  async function send<T>(options: ServiceRequest): Promise<ServiceResponse<T>> {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, endpoint.timeoutMs);

    try {
      const response = await fetch(new URL(options.path, endpoint.url), {
        method: options.method,
        headers: {
          accept: "application/json",
          [REQUEST_ID_HEADER]: options.requestId,
          ...(options.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") ?? "";

      const data = (
        contentType.includes("application/json")
          ? await response.json()
          : await response.text()
      ) as T;

      return { status: response.status, data };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw serviceUnavailable(
        `The ${endpoint.name} service ` +
          `${describeFailure(error, endpoint.timeoutMs)}.`,
        { code: ErrorCodes.UPSTREAM_UNAVAILABLE, cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function health(signal?: AbortSignal): Promise<void> {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, endpoint.timeoutMs);

    signal?.addEventListener("abort", () => {
      controller.abort();
    });

    try {
      const response = await fetch(new URL("/health", endpoint.url), {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `${endpoint.name} answered /health with ` +
            `${String(response.status)}.`,
        );
      }

      await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  return { endpoint, request: send, health };
}
