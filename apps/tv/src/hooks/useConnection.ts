import { useSyncExternalStore } from "react";
import type { ConnectionState } from "@betng/ui-core";
import { dataSource } from "../services/dataSource";

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    (onChange) => dataSource.subscribeConnection(onChange),
    () => dataSource.getConnectionState(),
    () => "CONNECTING" as const,
  );
}
