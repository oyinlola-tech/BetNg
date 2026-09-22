import { useEffect, useMemo, useState } from "react";
import type { LiveMatchSnapshot } from "@betng/ui-core";
import { liveRegistry } from "../lib/liveRegistry";

const IDLE: LiveMatchSnapshot = {
  match: undefined,
  connection: "CONNECTING",
  resyncing: false,
  error: undefined,
  lastEvent: undefined,
  syncedAt: undefined,
};

export function useLiveMatch(matchId: string | undefined): LiveMatchSnapshot {
  const snapshots = useLiveMatches(matchId === undefined ? [] : [matchId]);

  return matchId === undefined ? IDLE : (snapshots.get(matchId) ?? IDLE);
}

export function useLiveMatches(matchIds: readonly string[]): ReadonlyMap<string, LiveMatchSnapshot> {
  const key = [...new Set(matchIds)].sort().join(",");
  const ids = useMemo(() => (key === "" ? [] : key.split(",")), [key]);
  const [snapshots, setSnapshots] = useState<ReadonlyMap<string, LiveMatchSnapshot>>(new Map());

  useEffect(() => {
    if (ids.length === 0) {
      setSnapshots(new Map());

      return;
    }

    const held = ids.map((id) => ({ id, ...liveRegistry.acquire(id) }));
    const publish = (): void => {
      setSnapshots(new Map(held.map((h) => [h.id, h.controller.getSnapshot()])));
    };
    const unsubscribers = held.map((h) => h.controller.subscribe(publish));

    publish();

    return () => {
      for (const u of unsubscribers) u();
      for (const h of held) h.release();
    };
  }, [ids]);

  return snapshots;
}
