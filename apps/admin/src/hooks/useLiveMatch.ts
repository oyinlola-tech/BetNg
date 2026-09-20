import { useEffect, useState } from "react";
import type { MatchId } from "@betng/contracts";
import { watchMatch, type LiveMatchSnapshot } from "@betng/ui-core";
import { dataSource } from "../services/sources";

const IDLE: LiveMatchSnapshot = {
  match: undefined,
  connection: "CONNECTING",
  resyncing: false,
  error: undefined,
  lastEvent: undefined,
};

export function useLiveMatch(matchId: string | undefined): LiveMatchSnapshot {
  const [snapshot, setSnapshot] = useState<LiveMatchSnapshot>(IDLE);

  useEffect(() => {
    if (matchId === undefined) {
      setSnapshot(IDLE);
      return;
    }

    const controller = watchMatch(dataSource, matchId as MatchId);
    const unsubscribe = controller.subscribe(() => {
      setSnapshot(controller.getSnapshot());
    });
    const ticker = setInterval(() => {
      controller.tick();
    }, 1000);

    setSnapshot(controller.getSnapshot());

    return () => {
      clearInterval(ticker);
      unsubscribe();
      controller.stop();
    };
  }, [matchId]);

  return snapshot;
}
