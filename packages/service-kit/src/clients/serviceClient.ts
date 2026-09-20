/**
 * The service-to-service HTTP client.
 *
 * BetNG services talk to each other over the same REST API a client would
 * use — there is no private back channel. This client exists to make three
 * things automatic: the base URL comes from configuration rather than a
 * literal, the correlation id is forwarded, and a slow peer is abandoned
 * rather than allowed to hold a request open indefinitely.
 *
 * An unreachable or slow peer becomes a 503 carrying `UPSTREAM_UNAVAILABLE`,
 * so a caller never has to interpret a raw `fetch` failure.
 */

import { ErrorCodes, REQUEST_ID_HEADER } from "@betng/contracts";
import { HttpError, serviceUnavailable } from "@zudojs/http";
import type { ServiceEndpoint } from "../config/serviceConfig.js";
import type { DependencyProbe } from "../health/probes.js";

export interface ServiceResponse<T> {
  readonly status: number;
  readonly data: T;
}

export interface ServiceRequest {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to the peer's root, e.g. `/api/v1/matches`. */
  readonly path: string;
  readonly body?: unknown;
  /** The correlation id to forward. */
  readonly requestId: string;
}

export interface ServiceClient {
  readonly endpoint: ServiceEndpoint;
  readonly request: <T>(options: ServiceRequest) => Promise<ServiceResponse<T>>;
  /** Calls the peer's `/health`, for use as a readiness probe. */
  readonly health: (signal?: AbortSignal) => Promise<void>;
}

export function createServiceClient(endpoint: ServiceEndpoint): ServiceClient {
  async function send<T>(
    options: ServiceRequest,
  ): Promise<ServiceResponse<T>> {
    const url = new URL(options.path, endpoint.url);

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, endpoint.timeoutMs);

    try {
      const response = await fetch(url, {
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
      // An HttpError raised further in is already the answer we want.
      if (error instanceof HttpError) throw error;

      const reason =
        error instanceof Error && error.name === "AbortError"
          ? `did not respond within ${String(endpoint.timeoutMs)}ms`
          : "could not be reached";

      throw serviceUnavailable(
        `The ${endpoint.name} service ${reason}.`,
        { code: ErrorCodes.UPSTREAM_UNAVAILABLE, cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    endpoint,
    request: send,
    health: async (signal?: AbortSignal) => {
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
            `${endpoint.name} answered /health with ${String(response.status)}.`,
          );
        }
        // Drain the body so the connection can be reused.
        await response.text();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** A readiness probe that checks a peer service is answering. */
export function serviceProbe(
  client: ServiceClient,
  options: { readonly optional?: boolean } = {},
): DependencyProbe {
  return {
    name: `${client.endpoint.name}-service`,
    check: (signal) => client.health(signal),
    ...(options.optional === undefined ? {} : { optional: options.optional }),
  };
}
