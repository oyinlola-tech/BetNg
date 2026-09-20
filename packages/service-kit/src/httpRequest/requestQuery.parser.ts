/**
 * Query-string and path-parameter reading.
 */

import { ErrorCodes } from "@betng/contracts";
import { unprocessableEntity } from "@zudojs/http";
import { validate } from "@zudojs/validation";
import type { ValidationSchema } from "@zudojs/validation";
import { toErrorDetails } from "../httpError/index.js";

/**
 * Validates query parameters against a contract schema.
 *
 * A repeated parameter arrives as an array; the first value is taken, since
 * no BetNG endpoint currently accepts a repeated parameter.
 *
 * @param query - The parsed query string.
 * @param schema - The contract schema the query must satisfy.
 * @returns The validated query.
 * @throws A 422 listing every parameter that failed.
 */
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

/**
 * Reads a required path parameter.
 *
 * A missing parameter means the route pattern and its handler disagree, so
 * this raises a plain error and becomes a 500 rather than blaming a client
 * for a wiring mistake.
 *
 * @param params - The matched path parameters.
 * @param name - The parameter to read.
 * @returns The parameter's value.
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
