import { useSyncExternalStore } from "react";
import type { ConnectionState } from "@betng/ui-core";
import { getLastSyncedAt, subscribeLastSynced } from "../lib/queryClient";
import { dataSource } from "../services/runtime";

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    (onChange) => dataSource.subscribeConnection(onChange),
    () => dataSource.getConnectionState(),
    () => "CONNECTING" as const,
  );
}

export function useLastSyncedAt(): number | undefined {
  return useSyncExternalStore(subscribeLastSynced, getLastSyncedAt, () => undefined);
}

/** Live data is shown as the last update received, not as current, while this is true. */
export function useIsStale(): boolean {
  const state = useConnection();

  return state === "RECONNECTING" || state === "OFFLINE" || state === "FAILED";
}
