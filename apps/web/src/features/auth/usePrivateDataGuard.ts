import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateQueries } from "../../lib/queryClient";
import { session } from "../../services/runtime";

/** Drops private caches whenever the signed-in customer changes or the session ends, however it ended. */
export function usePrivateDataGuard(): void {
  const client = useQueryClient();

  useEffect(() => {
    let owner = session.snapshot().status === "AUTHENTICATED" ? session.snapshot().session?.user.id : undefined;

    return session.subscribe(() => {
      const { status, session: current } = session.snapshot();
      const next = status === "AUTHENTICATED" ? current?.user.id : undefined;

      if (next === owner) return;
      if (owner !== undefined) clearPrivateQueries(client);
      owner = next;
    });
  }, [client]);
}
