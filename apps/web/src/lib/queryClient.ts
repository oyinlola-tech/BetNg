import { QueryClient } from "@tanstack/react-query";
import { DataSourceError } from "@betng/ui-core";

const NO_RETRY = new Set(["NOT_FOUND", "NOT_IMPLEMENTED", "FORBIDDEN", "UNAUTHENTICATED", "SESSION_EXPIRED", "VALIDATION"]);

let lastSyncedAt: number | undefined;
const syncListeners = new Set<() => void>();

export function getLastSyncedAt(): number | undefined {
  return lastSyncedAt;
}

export function subscribeLastSynced(listener: () => void): () => void {
  syncListeners.add(listener);

  return () => {
    syncListeners.delete(listener);
  };
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        retry: (failures, error) => !(error instanceof DataSourceError && NO_RETRY.has(error.code)) && failures < 1,
      },
      mutations: { retry: false },
    },
  });

  client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;

    lastSyncedAt = Date.now();
    for (const listener of syncListeners) listener();
  });

  return client;
}
