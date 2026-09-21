import { useCallback } from "react";
import { useSearchParams } from "react-router";

export type ParamPatch = Readonly<Record<string, string | number | undefined>>;

/** Shareable filters live in the URL. A patch with `undefined` removes the parameter. */
export function useUrlState(): readonly [URLSearchParams, (patch: ParamPatch) => void] {
  const [params, setParams] = useSearchParams();

  const patch = useCallback(
    (changes: ParamPatch) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, String(value));
          }

          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [params, patch];
}

export function positiveInt(value: string | null): number | undefined {
  if (value === null || !/^\d{1,6}$/.test(value)) return undefined;

  const parsed = Number(value);

  return parsed > 0 ? parsed : undefined;
}

export function dateKey(value: string | null): string | undefined {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}
