import { QueryClient, type Query } from "@tanstack/react-query";
import { DataSourceError } from "@betng/ui-core";
import { ACCOUNT_QUERY_KEYS } from "./queryKeys";

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

/* Roots of every cache entry that belongs to the signed-in customer, including the money and account-service areas. */
const PRIVATE_ROOTS = new Set<unknown>([
  "wallet",
  "transactions",
  "bets",
  "notifications",
  "preferences",
  "viewed",
  "account",
  "payments",
  "bank-accounts",
  "banks",
  "deposits",
  "withdrawals",
  "kyc",
  "limits",
  "statements",
  "security",
  "devices",
  ...ACCOUNT_QUERY_KEYS.map((key) => key[0]),
]);

export function isPrivateQuery(query: Pick<Query, "queryKey">): boolean {
  return PRIVATE_ROOTS.has(query.queryKey[0]);
}

/** Cancels and drops every private cache entry, so nothing from the last session can render again. */
export function clearPrivateQueries(client: QueryClient): void {
  void client.cancelQueries({ predicate: isPrivateQuery });
  client.removeQueries({ predicate: isPrivateQuery });
}
