/**
 * Request body decoding and validation.
 *
 * The Node adapter hands a handler the raw request body as bytes. These
 * helpers decode it, then run it through the contract's schema using
 * `@zudojs/validation`. A failure becomes a 422 carrying
 * `VALIDATION_FAILED` and the offending field paths, so a client learns
 * what to fix rather than only that something was wrong.
 */

import { ErrorCodes } from "@betng/contracts";
import { badRequest, unprocessableEntity } from "@zudojs/http";
import type { HttpRequestContext } from "@zudojs/http";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { toErrorDetails } from "../httpError/index.js";

const decoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Decodes and JSON-parses a request body.
 *
 * @param request - The request context.
 * @returns The parsed value, or `undefined` for an empty body.
 * @throws A 400 when the body is not valid UTF-8 or not valid JSON.
 */
export function readJsonBody(request: HttpRequestContext): unknown {
  const body = request.body;

  if (body === undefined || body === null) {
    return undefined;
  }

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
    return body;
  }

  if (text.trim() === "") {
    return undefined;
  }

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
 * @param request - The request context.
 * @param schema - The contract schema the body must satisfy.
 * @returns The validated body.
 * @throws A 422 listing every field that failed.
 */
export function parseBody<T>(
  request: HttpRequestContext,
  schema: ValidationSchema<T>,
): T {
  const result = validate(schema, readJsonBody(request) ?? {});

  if (result.success) {
    return result.data;
  }

  throw unprocessableEntity("The request body failed validation.", {
    code: ErrorCodes.VALIDATION_FAILED,
    details: toErrorDetails(result.issues),
  });
}
