import { ErrorCodes } from "@betng/contracts";
import { unprocessableEntity } from "@zudojs/http";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { toErrorDetails } from "../httpError/index.js";

export function parseQuery<T>(
  query: Readonly<Record<string, string | string[]>>,
  schema: ValidationSchema<T>,
): T {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;

    if (first !== undefined) {
      flattened[key] = first;
    }
  }

  const result = validate(schema, flattened);

  if (result.success) {
    return result.data;
  }

  throw unprocessableEntity("The query string failed validation.", {
    code: ErrorCodes.VALIDATION_FAILED,
    details: toErrorDetails(result.issues),
  });
}

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
