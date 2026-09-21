import type { LeagueId } from "@betng/contracts";
import { formatMatchday, type MatchFilter, type MatchPhase, type MatchSummary } from "@betng/ui-core";
import { EmptyState, ErrorState, MatchCard, SectionHeading, Tabs, type EmptyPresetName } from "@betng/ui-web";
import { MatchRows } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useIsStale } from "../hooks/useConnection";
import { useLeagues, useMatches } from "../hooks/queries";
import { useUrlState } from "../lib/urlState";

type LobbyState = "open" | "live" | "betting" | "upcoming" | "finished";

const STATES: readonly { readonly value: LobbyState; readonly label: string }[] = [
  { value: "open", label: "All" },
  { value: "live", label: "Live" },
  { value: "betting", label: "Betting open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "finished", label: "Finished" },
];

const PHASES: Readonly<Record<LobbyState, readonly MatchPhase[]>> = {
  open: ["LIVE", "HALFTIME", "BETTING_CLOSED", "BETTING_OPEN", "SCHEDULED", "DELAYED", "SUSPENDED"],
  live: ["LIVE", "HALFTIME"],
  betting: ["BETTING_OPEN"],
  upcoming: ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED", "DELAYED"],
  finished: ["FINISHED", "SETTLED"],
};

const EMPTY: Readonly<Record<LobbyState, EmptyPresetName>> = {
  open: "noUpcomingMatches",
  live: "noLiveMatches",
  betting: "noUpcomingMatches",
  upcoming: "noUpcomingMatches",
  finished: "noResults",
};

interface MatchdayGroup {
  readonly key: string;
  readonly label: string;
  readonly matches: readonly MatchSummary[];
}

function groupByMatchday(matches: readonly MatchSummary[]): readonly MatchdayGroup[] {
  const groups = new Map<string, { label: string; matches: MatchSummary[] }>();

  for (const match of matches) {
    const key = `${match.leagueId}:${String(match.season)}:${String(match.matchday)}`;
    const group = groups.get(key);

    if (group === undefined) groups.set(key, { label: `${match.leagueName} · ${formatMatchday(match.matchday)}`, matches: [match] });
    else group.matches.push(match);
  }

  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

function isLobbyState(value: string | null): value is LobbyState {
  return STATES.some((state) => state.value === value);
}

export function LobbyPage(): React.JSX.Element {
  const stale = useIsStale();
  const leagues = useLeagues();
  const [params, patch] = useUrlState();
  const leagueParam = params.get("league") ?? undefined;
  const stateParam = params.get("state");
  const state: LobbyState = isLobbyState(stateParam) ? stateParam : "open";
  const filter: MatchFilter = {
    ...(leagueParam === undefined ? {} : { leagueId: leagueParam as LeagueId }),
    phases: PHASES[state],
    limit: 60,
  };
  const matches = useMatches(filter, { pace: state === "finished" ? "slow" : "live" });
  const groups = groupByMatchday(matches.data ?? []);
  const leagueName = leagues.data?.find((league) => league.id === leagueParam)?.name;

  usePageMeta({
    title: leagueName === undefined ? "Virtual football" : `${leagueName} fixtures`,
    description: "Virtual football fixtures with match-result prices, live scores and betting windows on BETNG.",
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-h1">Virtual football</h1>
        <p className="mt-1 text-base text-text-secondary">Fixtures, live scores and match-result prices for every competition.</p>
      </header>


      <Tabs
        label="Match state"
        scrollable
        value={state}
        onChange={(next) => {
          patch({ state: next === "open" ? undefined : next });
        }}
        items={STATES}
      />

      {matches.isPending ? (
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface" role="status" aria-label="Loading fixtures">
          {Array.from({ length: 8 }, (_, slot) => (
            <MatchCard.Skeleton key={slot} variant="compact" />
          ))}
        </div>
      ) : matches.isError && matches.data === undefined ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState preset={EMPTY[state]} />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`lobby-${group.key}`}>
              <SectionHeading id={`lobby-${group.key}`}>{group.label}</SectionHeading>
              <MatchRows matches={group.matches} withMarkets stale={stale} showCompetition={false} label={group.label} className="mt-3" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
