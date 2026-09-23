import { useEffect, useRef, useState } from "react";
import type { MatchId } from "@betng/contracts";
import { watchMatch, type LiveMatchController, type LiveMatchSnapshot } from "@betng/ui-core";
import { dataSource } from "../services/dataSource";

const IDLE: LiveMatchSnapshot = {
  match: undefined,
  connection: "CONNECTING",
  resyncing: false,
  error: undefined,
  lastEvent: undefined,
  syncedAt: undefined,
};

/** The shared live-match watcher, so the terminal sees exactly what the web Match Centre sees. */
export function useLiveMatch(matchId: string | undefined): LiveMatchSnapshot {
  const [snapshot, setSnapshot] = useState<LiveMatchSnapshot>(IDLE);
  const controllerRef = useRef<LiveMatchController | undefined>(undefined);

  useEffect(() => {
    if (matchId === undefined) {
      setSnapshot(IDLE);

      return;
    }

    const controller = watchMatch(dataSource, matchId as MatchId);
    const unsubscribe = controller.subscribe(() => {
      setSnapshot(controller.getSnapshot());
    });

    controllerRef.current = controller;
    setSnapshot(controller.getSnapshot());

    return () => {
      controllerRef.current = undefined;
      unsubscribe();
      controller.stop();
    };
  }, [matchId]);

  return snapshot;
}
