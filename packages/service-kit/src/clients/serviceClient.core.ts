import { internalHeaders } from "../internalAuth/index.js";
import { ErrorCodes, REQUEST_ID_HEADER } from "@betng/contracts";
import { HttpError, serviceUnavailable } from "@zudojs/http";
import type { ServiceEndpoint } from "../serviceConfig/index.js";

export interface ServiceResponse<T> {
  readonly status: number;
  readonly data: T;
  readonly contentType?: string;
  readonly contentDisposition?: string;
}

export interface ServiceRequest {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  /** Sent byte for byte instead of `body`, for callers that must not re-serialise (webhooks). */
  readonly rawBody?: Uint8Array;
  readonly contentType?: string;
  readonly requestId: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ServiceClient {
  readonly endpoint: ServiceEndpoint;
  readonly request: <T>(options: ServiceRequest) => Promise<ServiceResponse<T>>;
  readonly health: (signal?: AbortSignal) => Promise<void>;
}

function describeFailure(error: unknown, timeoutMs: number): string {
  return error instanceof Error && error.name === "AbortError"
    ? `did not respond within ${String(timeoutMs)}ms`
    : "could not be reached";
}

export function createServiceClient(endpoint: ServiceEndpoint): ServiceClient {
  async function send<T>(options: ServiceRequest): Promise<ServiceResponse<T>> {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, endpoint.timeoutMs);

    const payload: { body?: string | Uint8Array; contentType?: string } =
      options.rawBody !== undefined
        ? { body: options.rawBody, contentType: options.contentType ?? "application/octet-stream" }
        : options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body), contentType: "application/json" };

    try {
      const response = await fetch(new URL(options.path, endpoint.url), {
        method: options.method,
        headers: {
          accept: "application/json",
          [REQUEST_ID_HEADER]: options.requestId,
          ...(payload.contentType === undefined
            ? {}
            : { "content-type": payload.contentType }),
          ...options.headers,
          ...internalHeaders(),
        },
        ...(payload.body === undefined ? {} : { body: payload.body }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") ?? "";

      const text = await response.text();

      const data = (
        text !== "" && contentType.includes("application/json")
          ? JSON.parse(text)
          : text
      ) as T;

      const disposition = response.headers.get("content-disposition");

      return {
        status: response.status,
        data,
        ...(contentType === "" ? {} : { contentType }),
        ...(disposition === null ? {} : { contentDisposition: disposition }),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw serviceUnavailable(
        `The ${endpoint.name} service ` +
          `${describeFailure(error, endpoint.timeoutMs)}.`,
        { code: ErrorCodes.UPSTREAM_UNAVAILABLE, cause: error, expose: true },
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
