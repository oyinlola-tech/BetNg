import { useEffect } from "react";
import { formatMatchday } from "@betng/ui-core";
import { EmptyState, ErrorState, LeagueTable, Select, TableSkeleton } from "@betng/ui-web";
import { usePageMeta } from "../features/seo";
import { useLeagues, useStandings } from "../hooks/queries";
import { paths } from "../lib/paths";
import { positiveInt, useUrlState } from "../lib/urlState";

const SEASONS_SHOWN = 6;

export function StandingsPage(): React.JSX.Element {
  const leagues = useLeagues();
  const [params, patch] = useUrlState();
  const firstLeagueId = leagues.data?.[0]?.id;
  const leagueId = params.get("league") ?? firstLeagueId;
  const league = leagues.data?.find((entry) => entry.id === leagueId);
  const season = positiveInt(params.get("season"));
  const standings = useStandings(leagueId, season);
  const currentSeason = league?.currentSeason;
  const seasons = currentSeason === undefined ? [] : Array.from({ length: Math.min(currentSeason, SEASONS_SHOWN) }, (_, index) => currentSeason - index);

  useEffect(() => {
    if (params.get("league") === null && firstLeagueId !== undefined) patch({ league: firstLeagueId });
  }, [params, firstLeagueId, patch]);

  usePageMeta({
    title: league === undefined ? "Standings" : `${league.name} table`,
    description: "League tables for BETNG virtual football, with form and season history.",
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-h1">Standings</h1>
          <p className="mt-1 text-base text-text-secondary">
            {standings.data === undefined
              ? "League tables as the platform computed them."
              : `Season ${String(standings.data.season)}, after ${formatMatchday(standings.data.matchdaysPlayed).toLowerCase()}.`}
          </p>
        </div>
        {seasons.length > 1 && currentSeason !== undefined && (
          <Select
            label="Season"
            size="sm"
            value={String(season ?? currentSeason)}
            onChange={(value) => {
              patch({ season: Number(value) === currentSeason ? undefined : value });
            }}
            options={seasons.map((value) => ({ value: String(value), label: `Season ${String(value)}` }))}
          />
        )}
      </header>


      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {leagues.isError ? (
          <ErrorState error={leagues.error} onRetry={() => void leagues.refetch()} />
        ) : standings.isError && standings.data === undefined ? (
          <ErrorState error={standings.error} onRetry={() => void standings.refetch()} />
        ) : standings.data === undefined ? (
          <TableSkeleton rows={12} columns={8} />
        ) : standings.data.rows.length === 0 ? (
          <EmptyState title="No table yet" description="The table appears once the first matchday of the season is complete." />
        ) : (
          <LeagueTable
            standings={standings.data}
            teamHref={(row) => paths.team(row.team.id)}
            caption={league === undefined ? "League table" : `${league.name} table`}
          />
        )}
      </div>
    </div>
  );
}
