import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const THROTTLE_MS = 5000;

/** When anything on screen was last read successfully, for the connection strip's "last updated". */
export function useLastUpdated(): number | undefined {
  const client = useQueryClient();
  const [at, setAt] = useState<number | undefined>();

  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "success") return;

        const now = Date.now();

        setAt((previous) => (previous !== undefined && now - previous < THROTTLE_MS ? previous : now));
      }),
    [client],
  );

  return at;
}
