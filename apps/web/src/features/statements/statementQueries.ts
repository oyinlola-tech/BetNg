import { useMutation, useQuery } from "@tanstack/react-query";
import type { StatementRequest } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { useSignedIn } from "../../hooks/accountQueries";
import { keys } from "../../lib/queryKeys";
import { accountServices } from "../../services/runtime";
import { pollDelay } from "../payments/paymentMeta";

export const STATEMENT_POLL_DELAYS_MS: readonly number[] = [1_500, 2_000, 3_000, 5_000, 8_000];

export function useCreateStatement() {
  return useMutation({ mutationFn: (request: StatementRequest) => accountServices.security.createStatement(request) });
}

/** Polls a statement job until the platform reports it ready, failed or expired. */
export function useStatement(id: string | undefined, delays: readonly number[] = STATEMENT_POLL_DELAYS_MS) {
  const signedIn = useSignedIn();

  return useQuery({
    queryKey: keys.statement(id ?? ""),
    queryFn: () => accountServices.security.getStatement(id ?? ""),
    enabled: signedIn && id !== undefined,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const { data, error, dataUpdateCount } = query.state;

      if (data !== undefined && data.status !== "QUEUED") return false;
      if (error instanceof DataSourceError && error.code === "RATE_LIMITED") return Math.max(1, error.detail.retryAfterSeconds ?? 30) * 1000;
      if (error !== null) return false;

      return pollDelay(Math.max(0, dataUpdateCount - 1), delays);
    },
  });
}
