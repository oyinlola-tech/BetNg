import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MatchId } from "@betng/contracts";
import { watchMatch, type LiveMatchSnapshot } from "@betng/ui-core";
import { dataSource } from "../services/dataSource";

const IDLE: LiveMatchSnapshot = {
  match: undefined,
  connection: "CONNECTING",
  resyncing: false,
  error: undefined,
  lastEvent: undefined,
};

export function useLiveMatch(matchId: string | undefined): LiveMatchSnapshot {
  const controller = useMemo(
    () => (matchId === undefined ? undefined : watchMatch(dataSource, matchId as MatchId)),
    [matchId],
  );

  useEffect(() => {
    if (controller === undefined) return;

    const timer = setInterval(() => {
      controller.tick();
    }, 1000);

    return () => {
      clearInterval(timer);
      controller.stop();
    };
  }, [controller]);

  return useSyncExternalStore(
    (onChange) => controller?.subscribe(onChange) ?? (() => undefined),
    () => controller?.getSnapshot() ?? IDLE,
    () => IDLE,
  );
}
