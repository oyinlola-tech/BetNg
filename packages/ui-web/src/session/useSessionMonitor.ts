import { useSyncExternalStore } from "react";
import type { SessionMonitor, SessionMonitorState } from "@betng/ui-core";

export function useSessionMonitor(monitor: SessionMonitor): SessionMonitorState {
  return useSyncExternalStore(monitor.subscribe, monitor.state, monitor.state);
}
