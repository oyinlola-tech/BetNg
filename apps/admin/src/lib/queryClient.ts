import { QueryCache, QueryClient } from "@tanstack/react-query";
import { DataSourceError, type Logger } from "@betng/ui-core";

const NO_RETRY = new Set(["FORBIDDEN", "UNAUTHENTICATED", "SESSION_EXPIRED", "NOT_FOUND", "VALIDATION", "NOT_IMPLEMENTED", "CONFLICT"]);

export function createQueryClient(logger?: Logger): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (error instanceof DataSourceError && (error.code === "SESSION_EXPIRED" || error.code === "FORBIDDEN")) return;

        logger?.warn("api", "A query failed", { key: String(query.queryKey[1] ?? query.queryKey[0]), code: error instanceof DataSourceError ? error.code : "UNKNOWN" });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 5000,
        refetchOnWindowFocus: true,
        retry: (failures, error) => failures < 1 && !(error instanceof DataSourceError && NO_RETRY.has(error.code)),
      },
    },
  });
}
