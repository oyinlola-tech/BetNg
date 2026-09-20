import { useSyncExternalStore } from "react";
import type { ConnectionState } from "@betng/ui-core";
import { getDataSource } from "../services/dataSource";

export function useConnection(): ConnectionState {
  return useSyncExternalStore(
    (onChange) => getDataSource().subscribeConnection(onChange),
    () => getDataSource().getConnectionState(),
    () => "CONNECTING" as const,
  );
}
