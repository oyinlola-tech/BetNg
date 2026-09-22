import { createHash } from "node:crypto";
import type { ProviderId } from "../constants/payments.constant.js";

/** The provider could not be reached, timed out, or answered 5xx/429 or nonsense. Safe to retry. */
export class ProviderUnavailableError extends Error {
  public readonly provider: ProviderId;

  public constructor(provider: ProviderId, detail: string) {
    super(`${provider} unavailable: ${detail}`);
    this.name = "ProviderUnavailableError";
    this.provider = provider;
  }
}

/** The provider answered and refused (4xx). Only the status is kept: provider messages can carry personal data. */
export class ProviderRefusedError extends Error {
  public readonly provider: ProviderId;

  public readonly status: number;

  public constructor(provider: ProviderId, status: number) {
    super(`${provider} refused the request with ${String(status)}.`);
    this.name = "ProviderRefusedError";
    this.provider = provider;
    this.status = status;
  }
}

export class WebhookRejectedError extends Error {
  public constructor(reason: string) {
    super(reason);
    this.name = "WebhookRejectedError";
  }
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface ProviderRequest {
  readonly provider: ProviderId;
  readonly baseUrl: string;
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly secretKey: string;
  readonly timeoutMs: number;
  readonly body?: unknown;
}

export async function callProvider(request: ProviderRequest): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, request.timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${request.baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${request.secretKey}`,
        accept: "application/json",
        ...(request.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    throw new ProviderUnavailableError(
      request.provider,
      error instanceof Error && error.name === "AbortError" ? "timed out" : "unreachable",
    );
  }

  try {
    const text = await response.text();

    if (text.length > MAX_RESPONSE_BYTES) {
      throw new ProviderUnavailableError(request.provider, "response too large");
    }

    if (response.status >= 500 || response.status === 429) {
      throw new ProviderUnavailableError(request.provider, `status ${String(response.status)}`);
    }

    if (response.status >= 400) {
      throw new ProviderRefusedError(request.provider, response.status);
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ProviderUnavailableError(request.provider, "response is not JSON");
    }
  } catch (error) {
    if (error instanceof ProviderUnavailableError || error instanceof ProviderRefusedError) {
      throw error;
    }

    throw new ProviderUnavailableError(request.provider, "response could not be read");
  } finally {
    clearTimeout(timer);
  }
}

export function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function stringField(value: unknown, key: string): string | undefined {
  const field = record(value)?.[key];

  return typeof field === "string" ? field : typeof field === "number" ? String(field) : undefined;
}

export function integerField(value: unknown, key: string): number | undefined {
  const field = record(value)?.[key];
  const number = typeof field === "string" && /^\d+$/u.test(field) ? Number(field) : field;

  return typeof number === "number" && Number.isSafeInteger(number) ? number : undefined;
}

/** `1500`, `1500.5`, `"1500.50"` naira → kobo, exactly. Anything with more precision is refused, not rounded. */
export function nairaToKobo(value: unknown): number | undefined {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : undefined;
  const match = text === undefined ? null : /^(\d{1,13})(?:\.(\d{1,2}))?$/u.exec(text);

  if (match === null) {
    return undefined;
  }

  const kobo = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));

  return Number.isSafeInteger(kobo) ? kobo : undefined;
}

export function koboToNaira(kobo: number): string {
  return `${String(Math.trunc(kobo / 100))}.${String(kobo % 100).padStart(2, "0")}`;
}

export function bodyDigest(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

export function parseJson(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new WebhookRejectedError("The webhook body is not JSON.");
  }
}
