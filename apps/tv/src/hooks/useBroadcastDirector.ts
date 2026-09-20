import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import type { MatchSummary } from "@betng/ui-core";
import { useAsync } from "./useAsync";
import { useBroadcastMode } from "./useBroadcastMode";
import { dataSource } from "../services/dataSource";

const RESULTS_HOLD_MS = 14_000;
const TABLE_HOLD_MS = 14_000;

type Stage = "LIVE" | "RESULTS" | "TABLE" | "NEXT";

/* Runs the channel: live match → results → table → next kick-off → live, forever, unless a viewer takes over. */
export function useBroadcastDirector(): void {
  const [on] = useBroadcastMode();
  const navigate = useNavigate();
  const location = useLocation();
  const live = useAsync(
    () =>
      on
        ? dataSource.listMatches({ phases: ["LIVE", "HALFTIME"] })
        : Promise.resolve([] as readonly MatchSummary[]),
    [on],
    3000,
  );
  const finished = useAsync(
    () =>
      on
        ? dataSource.listMatches({ phases: ["FINISHED", "SETTLED"], limit: 12 })
        : Promise.resolve([] as readonly MatchSummary[]),
    [on],
    5000,
  );
  const stage = useRef<{
    stage: Stage;
    since: number;
    matchId?: string;
    leagueId?: string;
  }>({ stage: "LIVE", since: 0 });

  useEffect(() => {
    if (!on || live.data === undefined || finished.data === undefined) return;

    const now = Date.now();
    const current = stage.current;
    const path = location.pathname;
    const go = (to: string): void => {
      if (path !== to) void navigate(to, { replace: true });
    };

    const pick = [...live.data].sort((a, b) =>
      a.kickoffAt.localeCompare(b.kickoffAt),
    )[0];

    switch (current.stage) {
      case "LIVE": {
        if (pick !== undefined) {
          stage.current = {
            stage: "LIVE",
            since: current.matchId === pick.id ? current.since : now,
            matchId: pick.id,
            leagueId: pick.leagueId,
          };
          go(`/live/${pick.id}`);
          return;
        }

        const lastLeague = current.leagueId ?? finished.data[0]?.leagueId;

        stage.current = {
          stage: "RESULTS",
          since: now,
          ...(lastLeague === undefined ? {} : { leagueId: lastLeague }),
        };
        go(
          lastLeague === undefined
            ? "/results"
            : `/results?league=${lastLeague}`,
        );
        return;
      }
      case "RESULTS": {
        if (pick !== undefined && now - current.since > 4000) {
          stage.current = {
            stage: "LIVE",
            since: now,
            matchId: pick.id,
            leagueId: pick.leagueId,
          };
          go(`/live/${pick.id}`);
          return;
        }
        if (now - current.since > RESULTS_HOLD_MS) {
          stage.current = { ...current, stage: "TABLE", since: now };
          go(
            current.leagueId === undefined
              ? "/standings"
              : `/standings?league=${current.leagueId}`,
          );
        }
        return;
      }
      case "TABLE": {
        if (pick !== undefined) {
          stage.current = {
            stage: "LIVE",
            since: now,
            matchId: pick.id,
            leagueId: pick.leagueId,
          };
          go(`/live/${pick.id}`);
          return;
        }
        if (now - current.since > TABLE_HOLD_MS) {
          stage.current = { ...current, stage: "NEXT", since: now };
          go("/upcoming");
        }
        return;
      }
      case "NEXT": {
        if (pick !== undefined) {
          stage.current = {
            stage: "LIVE",
            since: now,
            matchId: pick.id,
            leagueId: pick.leagueId,
          };
          go(`/live/${pick.id}`);
        }
        return;
      }
    }
  }, [on, live.data, finished.data, location.pathname, navigate]);
}
