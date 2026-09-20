import { REQUEST_ID_HEADER } from "@betng/contracts/runtime";
import { DEFAULT_TIMEOUT_MS, type BetNgClientConfig } from "../config/index.js";
import { BetNgApiError, isErrorResponse } from "./restError.js";

export interface ListResponse<T> {
  readonly items: readonly T[];
}

export type Requester = <T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown) => Promise<T>;

export function buildQuery(query: Readonly<Record<string, string | number | undefined>>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  const search = params.toString();

  return search === "" ? "" : `?${search}`;
}

export function createRequester(config: BetNgClientConfig): Requester {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // A client-generated id lets a user report a failure by quoting it, and the platform echoes it through every service the request touched.
    const requestId = crypto.randomUUID();
    const token = config.getToken?.();

    try {
      const response = await fetch(new URL(path, config.gatewayUrl), {
        method,
        headers: {
          accept: "application/json",
          [REQUEST_ID_HEADER]: requestId,
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });

      const text = response.status === 204 ? "" : await response.text();
      const payload: unknown = text === "" ? undefined : JSON.parse(text);

      if (!response.ok) {
        if (response.status === 401 && token !== undefined) config.onUnauthorized?.();

        if (isErrorResponse(payload)) throw new BetNgApiError(response.status, payload.error);

        throw new BetNgApiError(response.status, {
          code: response.status === 401 ? "UNAUTHENTICATED" : response.status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR",
          message: `The platform answered ${String(response.status)}.`,
          requestId,
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof BetNgApiError) throw error;

      // A timeout and a network failure both look like "no answer" to a user, but only one is worth retrying.
      const timedOut = error instanceof Error && error.name === "AbortError";

      throw new BetNgApiError(0, {
        code: timedOut ? "SERVICE_UNAVAILABLE" : "UPSTREAM_UNAVAILABLE",
        message: timedOut ? `The platform did not answer within ${String(timeoutMs)}ms.` : "The platform could not be reached.",
        requestId,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
