import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday, formatShortDate, toLocalDateKey, type MatchFilter, type MatchSummary } from "@betng/ui-core";
import { EmptyState, ErrorState, IconButton, MatchCard, SectionHeading, Select, Tabs } from "@betng/ui-web";
import { MatchRows } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useCompletedMatchdays, useLeagues, useMatches } from "../hooks/queries";
import { dateKey, positiveInt, useUrlState } from "../lib/urlState";

type Mode = "day" | "matchday";

const SEASONS_SHOWN = 6;

function shiftDate(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00`);

  date.setDate(date.getDate() + days);

  return toLocalDateKey(date);
}

function dayLabel(key: string, today: string): string {
  if (key === today) return "Today";
  if (key === shiftDate(today, -1)) return "Yesterday";

  return formatShortDate(new Date(`${key}T12:00:00`).toISOString());
}

function groupResults(matches: readonly MatchSummary[]): readonly { readonly key: string; readonly label: string; readonly matches: readonly MatchSummary[] }[] {
  const groups = new Map<string, { label: string; matches: MatchSummary[] }>();

  for (const match of matches) {
    const key = `${match.leagueId}:${String(match.season)}:${String(match.matchday)}`;
    const group = groups.get(key);

    if (group === undefined) {
      groups.set(key, { label: `${match.leagueName} · Season ${String(match.season)} · ${formatMatchday(match.matchday)}`, matches: [match] });
    } else {
      group.matches.push(match);
    }
  }

  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

export function ResultsPage(): React.JSX.Element {
  const leagues = useLeagues();
  const [params, patch] = useUrlState();
  const today = toLocalDateKey(new Date());
  const leagueParam = params.get("league") ?? undefined;
  const matchdayParam = positiveInt(params.get("matchday"));
  const seasonParam = positiveInt(params.get("season"));
  const date = dateKey(params.get("date")) ?? today;
  const mode: Mode = matchdayParam !== undefined || params.get("view") === "matchday" ? "matchday" : "day";

  const league = leagues.data?.find((entry) => entry.id === leagueParam);
  const matchdayLeagueId = mode === "matchday" ? (leagueParam ?? leagues.data?.[0]?.id) : undefined;
  const matchdayLeague = leagues.data?.find((entry) => entry.id === matchdayLeagueId);
  const season = seasonParam ?? matchdayLeague?.currentSeason;
  const matchdays = useCompletedMatchdays(matchdayLeagueId, season);
  const matchday = matchdayParam ?? matchdays.data?.[0];

  const filter: MatchFilter =
    mode === "day"
      ? { phases: ["FINISHED", "SETTLED"], date, limit: 80, ...(leagueParam === undefined ? {} : { leagueId: leagueParam as LeagueId }) }
      : {
          phases: ["FINISHED", "SETTLED"],
          ...(matchdayLeagueId === undefined ? {} : { leagueId: matchdayLeagueId as LeagueId }),
          ...(season === undefined ? {} : { season }),
          ...(matchday === undefined ? {} : { matchday }),
        };
  const ready = mode === "day" || (matchdayLeagueId !== undefined && season !== undefined && matchday !== undefined);
  const results = useMatches(filter, { enabled: ready, pace: "slow" });
  const groups = groupResults(results.data ?? []);
  const noMatchdays = mode === "matchday" && matchdays.data !== undefined && matchdays.data.length === 0;

  usePageMeta({
    title: league === undefined ? "Results" : `${league.name} results`,
    description: "Full-time scores from BETNG virtual football, by day or by matchday.",
  });

  const currentSeason = matchdayLeague?.currentSeason;
  const seasonOptions =
    currentSeason === undefined
      ? []
      : Array.from({ length: Math.min(currentSeason, SEASONS_SHOWN) }, (_, index) => currentSeason - index).map((value) => ({
          value: String(value),
          label: `Season ${String(value)}`,
        }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-h1">Results</h1>
        <p className="mt-1 text-base text-text-secondary">Full-time scores as the platform reported them.</p>
      </header>


      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Browse results by"
          variant="segmented"
          value={mode}
          onChange={(next) => {
            if (next === "day") patch({ view: undefined, matchday: undefined, season: undefined });
            else patch({ view: "matchday", date: undefined, league: leagueParam ?? leagues.data?.[0]?.id });
          }}
          items={[
            { value: "day", label: "By day" },
            { value: "matchday", label: "By matchday" },
          ]}
        />
        {mode === "day" ? (
          <div className="flex items-center gap-1" role="group" aria-label="Date">
            <IconButton
              label="Previous day"
              size="sm"
              onClick={() => {
                patch({ date: shiftDate(date, -1) });
              }}
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-32 text-center type-data font-semibold" aria-live="polite">
              {dayLabel(date, today)}
            </span>
            <IconButton
              label="Next day"
              size="sm"
              disabled={date >= today}
              onClick={() => {
                const next = shiftDate(date, 1);

                patch({ date: next === today ? undefined : next });
              }}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {seasonOptions.length > 0 && season !== undefined && (
              <Select
                label="Season"
                size="sm"
                value={String(season)}
                onChange={(value) => {
                  patch({ season: Number(value) === currentSeason ? undefined : value, matchday: undefined });
                }}
                options={seasonOptions}
              />
            )}
            {matchday !== undefined && (matchdays.data?.length ?? 0) > 0 && (
              <Select
                label="Matchday"
                size="sm"
                value={String(matchday)}
                onChange={(value) => {
                  patch({ matchday: value });
                }}
                options={(matchdays.data ?? []).map((value) => ({ value: String(value), label: formatMatchday(value) }))}
              />
            )}
          </div>
        )}
      </div>

      {noMatchdays ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState preset="noResults" description="No matchday has been completed in this season yet." />
        </div>
      ) : results.isPending ? (
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface" role="status" aria-label="Loading results">
          {Array.from({ length: 8 }, (_, slot) => (
            <MatchCard.Skeleton key={slot} variant="compact" />
          ))}
        </div>
      ) : results.isError && results.data === undefined ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={results.error} onRetry={() => void results.refetch()} />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            preset="noResults"
            description={mode === "day" ? "No matches finished on this day." : "This matchday has no finished matches."}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`results-${group.key}`}>
              <SectionHeading id={`results-${group.key}`}>{group.label}</SectionHeading>
              <MatchRows matches={group.matches} withOutcome showCompetition={false} label={group.label} className="mt-3" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
