/**
 * Request parsing and validation.
 *
 * The Node adapter hands a handler the raw request body as bytes. These
 * helpers decode it, then run it through the contract's schema using
 * `@zudojs/validation`. A failure becomes a 422 carrying `VALIDATION_FAILED`
 * and the offending field paths, so a client learns what to fix rather than
 * just that something was wrong.
 */

import { ErrorCodes } from "@betng/contracts";
import { badRequest, unprocessableEntity } from "@zudojs/http";
import type { HttpRequestContext } from "@zudojs/http";
import { validate, type ValidationSchema } from "@zudojs/validation";
import { toErrorDetails } from "./errors.js";

const decoder = new TextDecoder("utf-8", { fatal: true });

/** Decodes and JSON-parses a request body. */
export function readJsonBody(request: HttpRequestContext): unknown {
  const body = request.body;

  if (body === undefined || body === null) return undefined;

  let text: string;

  if (typeof body === "string") {
    text = body;
  } else if (body instanceof Uint8Array) {
    try {
      text = decoder.decode(body);
    } catch {
      throw badRequest("Request body is not valid UTF-8.", {
        code: ErrorCodes.VALIDATION_FAILED,
      });
    }
  } else {
    // Some adapters hand over an already-parsed value; pass it through.
    return body;
  }

  if (text.trim() === "") return undefined;

  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Request body is not valid JSON.", {
      code: ErrorCodes.VALIDATION_FAILED,
    });
  }
}

/**
 * Validates a request body against a contract schema.
 *
 * @throws A 422 `HttpError` listing every field that failed.
 */
export function parseBody<T>(
  request: HttpRequestContext,
  schema: ValidationSchema<T>,
): T {
  const result = validate(schema, readJsonBody(request) ?? {});

  if (result.success) return result.data;

  throw unprocessableEntity("The request body failed validation.", {
    code: ErrorCodes.VALIDATION_FAILED,
    details: toErrorDetails(result.issues),
  });
}

/**
 * Validates query parameters against a contract schema.
 *
 * Repeated parameters arrive as arrays; the first value is taken, since no
 * BetNG endpoint currently accepts a repeated parameter.
 */
export function parseQuery<T>(
  query: Readonly<Record<string, string | string[]>>,
  schema: ValidationSchema<T>,
): T {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) flattened[key] = first;
  }

  const result = validate(schema, flattened);

  if (result.success) return result.data;

  throw unprocessableEntity("The query string failed validation.", {
    code: ErrorCodes.VALIDATION_FAILED,
    details: toErrorDetails(result.issues),
  });
}

/**
 * Reads a required path parameter.
 *
 * A missing parameter means the route pattern and the handler disagree, so
 * this is a 500 rather than a client error.
 */
export function requireParam(
  params: Readonly<Record<string, string>>,
  name: string,
): string {
  const value = params[name];
  if (value === undefined || value === "") {
    throw new Error(
      `Route parameter "${name}" is missing. The route pattern and its ` +
        `handler disagree.`,
    );
  }
  return value;
}
