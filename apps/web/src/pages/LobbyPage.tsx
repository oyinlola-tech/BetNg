import { useMemo, useState } from "react";
import { Radio } from "lucide-react";
import {
  formatMatchday,
  type MatchPhase,
  type MatchSummary,
} from "@betng/ui-core";
import { MatchRow } from "../components/domain";
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  Select,
  SkeletonRows,
  Tabs,
} from "../components/ui";
import { useLeagues, useMatches } from "../hooks/queries";

type View = "ALL" | "LIVE" | "UPCOMING" | "FINISHED";

const PHASES: Record<Exclude<View, "ALL">, readonly MatchPhase[]> = {
  LIVE: ["LIVE", "HALFTIME"],
  UPCOMING: ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED"],
  FINISHED: ["FINISHED", "SETTLED"],
};

function groupByMatchday(
  matches: readonly MatchSummary[],
): readonly {
  readonly key: string;
  readonly label: string;
  readonly items: readonly MatchSummary[];
}[] {
  const groups = new Map<string, MatchSummary[]>();

  for (const m of matches) {
    const key = `${m.leagueCode}:${String(m.season)}:${String(m.matchday)}`;
    const list = groups.get(key) ?? [];

    list.push(m);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([key, items]) => {
    const first = items[0] as MatchSummary;

    return {
      key,
      label: `${first.leagueName} · ${formatMatchday(first.matchday)}`,
      items,
    };
  });
}

export function LobbyPage(): React.JSX.Element {
  const leagues = useLeagues();
  const [leagueId, setLeagueId] = useState<string>("all");
  const [view, setView] = useState<View>("ALL");

  const filter = useMemo(
    () => ({
      ...(leagueId === "all"
        ? {}
        : { leagueId: leagueId as MatchSummary["leagueId"] }),
      ...(view === "ALL" ? {} : { phases: PHASES[view] }),
    }),
    [leagueId, view],
  );
  const matches = useMatches(filter, { refetchMs: 3000 });

  const groups = useMemo(() => {
    const list = matches.data ?? [];
    const order: Record<MatchPhase, number> = {
      LIVE: 0,
      HALFTIME: 0,
      BETTING_CLOSED: 1,
      BETTING_OPEN: 2,
      SCHEDULED: 3,
      FINISHED: 4,
      SETTLED: 4,
      CANCELLED: 5,
    };
    const sorted = [...list].sort(
      (a, b) =>
        order[a.phase] - order[b.phase] ||
        a.kickoffAt.localeCompare(b.kickoffAt),
    );

    return groupByMatchday(sorted);
  }, [matches.data]);

  const counts = useMemo(() => {
    const all = matches.data ?? [];

    return {
      live: all.filter((m) => PHASES.LIVE.includes(m.phase)).length,
      upcoming: all.filter((m) => PHASES.UPCOMING.includes(m.phase)).length,
    };
  }, [matches.data]);

  return (
    <div className="space-y-5">
      <SectionHeader
        as="h1"
        eyebrow="Lobby"
        title="Virtual Football"
        aside={
          <Select
            label="League"
            size="sm"
            value={leagueId}
            onChange={setLeagueId}
            options={[
              { value: "all", label: "All leagues" },
              ...(leagues.data ?? []).map((l) => ({
                value: l.id,
                label: l.name,
              })),
            ]}
          />
        }
      />
      <Tabs
        label="Match state"
        value={view}
        onChange={setView}
        items={[
          { value: "ALL", label: "All" },
          {
            value: "LIVE",
            label: "Live",
            ...(view === "ALL" && counts.live > 0
              ? { count: counts.live }
              : {}),
          },
          {
            value: "UPCOMING",
            label: "Upcoming",
            ...(view === "ALL" && counts.upcoming > 0
              ? { count: counts.upcoming }
              : {}),
          },
          { value: "FINISHED", label: "Finished" },
        ]}
      />

      {matches.isPending ? (
        <div className="rounded-md border border-border bg-surface">
          <SkeletonRows rows={8} className="p-4" />
        </div>
      ) : matches.isError ? (
        <ErrorState
          error={matches.error}
          onRetry={() => void matches.refetch()}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Radio className="size-5" />}
          title={view === "LIVE" ? "No live matches" : "No matches"}
          description={
            view === "LIVE"
              ? "The next kick-off is moments away."
              : "Try another league or state."
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className="caps-label mb-2">{g.label}</h2>
              <div className="divide-y divide-border rounded-md border border-border bg-surface">
                {g.items.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
