import { ErrorCodes } from "@betng/contracts";
import { badRequest, unprocessableEntity } from "@zudojs/http";
import type { HttpRequestContext } from "@zudojs/http";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { toErrorDetails } from "../httpError/index.js";

const decoder = new TextDecoder("utf-8", { fatal: true });

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
