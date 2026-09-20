import { useState } from "react";
import { formatMatchday } from "@betng/ui-core";
import { LeagueTable } from "../components/domain";
import {
  ErrorState,
  SectionHeader,
  Select,
  SkeletonRows,
} from "../components/ui";
import { useLeague, useLeagues, useStandings } from "../hooks/queries";

export function StandingsPage(): React.JSX.Element {
  const leagues = useLeagues();
  const [leagueId, setLeagueId] = useState("");
  const [season, setSeason] = useState<number | undefined>(undefined);
  const effective = leagueId === "" ? leagues.data?.[0]?.id : leagueId;
  const league = useLeague(effective);
  const standings = useStandings(effective, season);
  const current = league.data?.currentSeason ?? 1;
  const seasons = Array.from(
    { length: Math.min(current, 6) },
    (_, i) => current - i,
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        as="h1"
        eyebrow={
          standings.data === undefined
            ? "League table"
            : `Season ${String(standings.data.season)} · after ${formatMatchday(standings.data.matchdaysPlayed)}`
        }
        title="Standings"
        aside={
          <div className="flex gap-2">
            <Select
              label="League"
              size="sm"
              value={effective ?? ""}
              onChange={(v) => {
                setLeagueId(v);
                setSeason(undefined);
              }}
              options={(leagues.data ?? []).map((l) => ({
                value: l.id,
                label: l.name,
              }))}
            />
            <Select
              label="Season"
              size="sm"
              value={String(season ?? current)}
              onChange={(v) => {
                setSeason(Number(v));
              }}
              options={seasons.map((s) => ({
                value: String(s),
                label: `Season ${String(s)}`,
              }))}
            />
          </div>
        }
      />
      <div className="rounded-md border border-border bg-surface">
        {standings.isPending ? (
          <SkeletonRows rows={12} className="p-4" />
        ) : standings.isError ? (
          <ErrorState
            error={standings.error}
            onRetry={() => void standings.refetch()}
          />
        ) : (
          <LeagueTable standings={standings.data} />
        )}
      </div>
      <p className="text-xs text-text-muted">
        Top two positions and bottom two positions are highlighted. Points: win
        3, draw 1.
      </p>
    </div>
  );
}
