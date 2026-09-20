import { useSyncExternalStore } from "react";
import type { SessionLike, SessionSnapshot, SessionStore } from "@betng/ui-core";

export function useSession<S extends SessionLike>(store: SessionStore<S>): SessionSnapshot<S> {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}
