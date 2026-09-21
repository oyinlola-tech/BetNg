import { REQUEST_ID_HEADER } from "@betng/contracts/runtime";
import { DEFAULT_TIMEOUT_MS, type BetNgClientConfig } from "../config/index.js";
import {
  BetNgApiError,
  codeForStatus,
  isErrorResponse,
  isRetryableStatus,
  type ApiFailureKind,
} from "./restError.js";

export interface ListResponse<T> {
  readonly items: readonly T[];
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface RequestOptions {
  /** Sent as `idempotency-key`, which the gateway forwards, so a repeated submission is recognised. */
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

export type Requester = <T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options?: RequestOptions,
) => Promise<T>;

export const IDEMPOTENCY_HEADER = "idempotency-key";

type QueryValue = string | number | boolean | readonly string[] | undefined;

export function buildQuery(query: Readonly<Record<string, QueryValue>>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return search === "" ? "" : `?${search}`;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function retryAfter(response: Response): number | undefined {
  const seconds = Number(response.headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createRequester(config: BetNgClientConfig): Requester {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = config.retries ?? 2;

  async function attempt<T>(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: RequestOptions,
    requestId: string,
  ): Promise<T> {
    if (isOffline()) {
      throw new BetNgApiError(
        0,
        { code: "UPSTREAM_UNAVAILABLE", message: "You are offline.", requestId },
        { kind: "offline" },
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const abort = (): void => {
      controller.abort();
    };

    options.signal?.addEventListener("abort", abort, { once: true });

    const token = config.getToken?.();

    try {
      const response = await fetch(new URL(path, config.gatewayUrl), {
        method,
        headers: {
          accept: "application/json",
          [REQUEST_ID_HEADER]: requestId,
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(options.idempotencyKey === undefined
            ? {}
            : { [IDEMPOTENCY_HEADER]: options.idempotencyKey }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      const text = response.status === 204 ? "" : await response.text();
      let payload: unknown;

      try {
        payload = text === "" ? undefined : JSON.parse(text);
      } catch {
        throw new BetNgApiError(
          response.status,
          {
            code: response.ok ? "INTERNAL_ERROR" : codeForStatus(response.status),
            message: "The platform sent an answer that could not be read.",
            requestId,
          },
          { kind: response.ok ? "parse" : "http" },
        );
      }

      if (!response.ok) {
        if (response.status === 401 && token !== undefined) {
          config.onUnauthorized?.();
        }

        const meta = { retryAfterSeconds: retryAfter(response) };

        if (isErrorResponse(payload)) {
          throw new BetNgApiError(response.status, payload.error, meta);
        }

        throw new BetNgApiError(
          response.status,
          {
            code: codeForStatus(response.status),
            message: `The platform answered ${String(response.status)}.`,
            requestId,
          },
          meta,
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof BetNgApiError) throw error;

      const aborted = error instanceof Error && error.name === "AbortError";
      const cancelled = aborted && options.signal?.aborted === true;
      const kind: ApiFailureKind = aborted && !cancelled ? "timeout" : "network";

      throw new BetNgApiError(
        0,
        {
          code: kind === "timeout" ? "SERVICE_UNAVAILABLE" : "UPSTREAM_UNAVAILABLE",
          message:
            kind === "timeout"
              ? `The platform did not answer within ${String(timeoutMs)}ms.`
              : "The platform could not be reached.",
          requestId,
        },
        { kind },
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  return async function request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    // A client-generated id lets a user report a failure by quoting it, and the platform echoes it through every service the request touched.
    const requestId = crypto.randomUUID();
    const started = Date.now();
    const budget = method === "GET" ? retries : 0;

    for (let tried = 0; ; tried += 1) {
      try {
        return await attempt<T>(method, path, body, options, requestId);
      } catch (error) {
        const failure = error as BetNgApiError;
        const transient =
          failure.kind === "network" ||
          failure.kind === "timeout" ||
          isRetryableStatus(failure.status);

        config.onRequestError?.({
          method,
          path: path.split("?")[0] ?? path,
          status: failure.status,
          code: failure.code,
          kind: failure.kind,
          requestId,
          durationMs: Date.now() - started,
          attempt: tried + 1,
        });

        if (!transient || tried >= budget || options.signal?.aborted === true) {
          throw failure;
        }

        await wait(250 * 2 ** tried + Math.random() * 150);
      }
    }
  };
}
