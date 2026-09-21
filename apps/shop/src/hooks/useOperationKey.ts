import { useCallback, useRef } from "react";
import { createIdempotencyKey } from "@betng/ui-core";

/** One idempotency key per logical operation: kept across retries, replaced only once the operation succeeds or its input changes. */
export function useOperationKey(): { readonly current: () => string; readonly renew: () => void } {
  const key = useRef<string | undefined>(undefined);

  const current = useCallback(() => {
    key.current ??= createIdempotencyKey();

    return key.current;
  }, []);

  const renew = useCallback(() => {
    key.current = undefined;
  }, []);

  return { current, renew };
}
