import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchId } from "@betng/contracts";
import { watchMatch, type LiveMatchController, type LiveMatchSnapshot } from "@betng/ui-core";
import { getDataSource } from "../services/dataSource";

const IDLE: LiveMatchSnapshot = {
  match: undefined,
  connection: "CONNECTING",
  resyncing: false,
  error: undefined,
  lastEvent: undefined,
  syncedAt: undefined,
};

export interface LiveMatchState extends LiveMatchSnapshot {
  /** Re-reads the match from the platform. */
  readonly resync: () => void;
}

export function useLiveMatch(matchId: string | undefined): LiveMatchState {
  const [snapshot, setSnapshot] = useState<LiveMatchSnapshot>(IDLE);
  const controllerRef = useRef<LiveMatchController | undefined>(undefined);

  useEffect(() => {
    if (matchId === undefined) {
      setSnapshot(IDLE);
      return;
    }

    const controller = watchMatch(getDataSource(), matchId as MatchId);

    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(() => {
      setSnapshot(controller.getSnapshot());
    });
    setSnapshot(controller.getSnapshot());

    return () => {
      unsubscribe();
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = undefined;
    };
  }, [matchId]);

  const resync = useCallback(() => {
    controllerRef.current?.resync();
  }, []);

  return { ...snapshot, resync };
}
