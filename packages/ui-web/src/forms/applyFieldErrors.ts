import { DataSourceError } from "@betng/ui-core";

export interface FieldErrorOption {
  readonly type: string;
  readonly message: string;
}

export type FieldErrorSetter<TName extends string> = (
  name: TName,
  error: FieldErrorOption,
) => void;

export interface AppliedFieldErrors<TName extends string> {
  readonly applied: readonly TName[];
  /** Server fields the form does not have. Show these at form level. */
  readonly unmatched: Readonly<Record<string, string>>;
}

const UNSAFE_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function isSafePath(name: string): boolean {
  return (
    name !== "" && !name.split(/[.[\]]/).some((part) => UNSAFE_KEYS.has(part))
  );
}

/**
 * Copies `DataSourceError.detail.fields` onto a form through its error setter, such as React Hook Form's `setError`.
 * Pass `fields` to accept only names the form owns; without it every safe name is applied.
 */
export function applyFieldErrors<TName extends string>(
  error: unknown,
  setError: FieldErrorSetter<TName>,
  fields?: readonly TName[],
): AppliedFieldErrors<TName> {
  const applied: TName[] = [];
  const unmatched: Record<string, string> = {};

  if (!(error instanceof DataSourceError) || error.detail.fields === undefined)
    return { applied, unmatched };

  const allowed = fields === undefined ? undefined : new Set<string>(fields);

  for (const [name, message] of Object.entries(error.detail.fields)) {
    if (!isSafePath(name) || typeof message !== "string") continue;

    if (allowed !== undefined && !allowed.has(name)) {
      unmatched[name] = message;
      continue;
    }

    setError(name as TName, { type: "server", message });
    applied.push(name as TName);
  }

  return { applied, unmatched };
}
