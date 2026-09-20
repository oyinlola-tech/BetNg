import { useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday } from "@betng/ui-core";
import { LeagueTable, MatchRow, TeamBadge } from "../components/domain";
import {
  EmptyState,
  ErrorState,
  SectionHeader,
  SkeletonRows,
  Tabs,
} from "../components/ui";
import {
  useLeague,
  useMatches,
  useStandings,
  useTopScorers,
} from "../hooks/queries";

type Section = "TABLE" | "FIXTURES" | "RESULTS" | "SCORERS";

export function LeaguePage(): React.JSX.Element {
  const { leagueId } = useParams<{ leagueId: string }>();
  const league = useLeague(leagueId);
  const standings = useStandings(leagueId);
  const scorers = useTopScorers(leagueId);
  const [section, setSection] = useState<Section>("TABLE");
  const fixtures = useMatches(
    {
      leagueId: leagueId as LeagueId,
      phases: [
        "LIVE",
        "HALFTIME",
        "BETTING_OPEN",
        "BETTING_CLOSED",
        "SCHEDULED",
      ],
    },
    { enabled: leagueId !== undefined },
  );
  const results = useMatches(
    {
      leagueId: leagueId as LeagueId,
      phases: ["FINISHED", "SETTLED"],
      limit: 24,
    },
    { enabled: leagueId !== undefined },
  );

  if (league.isError)
    return (
      <ErrorState error={league.error} onRetry={() => void league.refetch()} />
    );

  return (
    <div className="space-y-5">
      <Link
        to="/leagues"
        className="inline-flex items-center gap-0.5 text-sm text-text-muted hover:text-text-primary focus-ring rounded-xs"
      >
        <ChevronLeft className="size-4" /> Leagues
      </Link>
      <SectionHeader
        as="h1"
        eyebrow={
          league.data === undefined
            ? "League"
            : `${league.data.country} · Season ${String(league.data.currentSeason)} · ${formatMatchday(league.data.currentMatchday)}`
        }
        title={league.data?.name ?? "…"}
      />
      <Tabs
        label="League section"
        value={section}
        onChange={setSection}
        items={[
          { value: "TABLE", label: "Table" },
          { value: "FIXTURES", label: "Fixtures" },
          { value: "RESULTS", label: "Results" },
          { value: "SCORERS", label: "Top scorers" },
        ]}
      />

      {section === "TABLE" && (
        <div className="rounded-md border border-border bg-surface">
          {standings.isPending ? (
            <SkeletonRows rows={10} className="p-4" />
          ) : standings.isError ? (
            <ErrorState compact error={standings.error} />
          ) : (
            <LeagueTable standings={standings.data} />
          )}
        </div>
      )}

      {section === "FIXTURES" && (
        <div className="divide-y divide-border rounded-md border border-border bg-surface">
          {fixtures.isPending ? (
            <SkeletonRows rows={6} className="p-4" />
          ) : fixtures.isError ? (
            <ErrorState compact error={fixtures.error} />
          ) : fixtures.data.length === 0 ? (
            <EmptyState compact title="No fixtures" />
          ) : (
            fixtures.data.map((m) => <MatchRow key={m.id} match={m} />)
          )}
        </div>
      )}

      {section === "RESULTS" && (
        <div className="divide-y divide-border rounded-md border border-border bg-surface">
          {results.isPending ? (
            <SkeletonRows rows={6} className="p-4" />
          ) : results.isError ? (
            <ErrorState compact error={results.error} />
          ) : results.data.length === 0 ? (
            <EmptyState compact title="No results yet" />
          ) : (
            results.data.map((m) => <MatchRow key={m.id} match={m} />)
          )}
        </div>
      )}

      {section === "SCORERS" && (
        <div className="rounded-md border border-border bg-surface">
          {scorers.isPending ? (
            <SkeletonRows rows={8} className="p-4" />
          ) : scorers.isError ? (
            <ErrorState compact error={scorers.error} />
          ) : scorers.data.length === 0 ? (
            <EmptyState compact title="No goals yet this season" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="caps-label border-b border-border text-left">
                  <th className="w-8 py-2 pl-3">#</th>
                  <th className="py-2">Player</th>
                  <th className="py-2">Club</th>
                  <th className="w-14 py-2 text-right">Goals</th>
                  <th className="w-16 py-2 pr-3 text-right">Assists</th>
                </tr>
              </thead>
              <tbody>
                {scorers.data.map((s, i) => (
                  <tr
                    key={`${s.team.id}-${s.player}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 pl-3 tabular text-text-muted">
                      {i + 1}
                    </td>
                    <td className="py-2 font-medium">{s.player}</td>
                    <td className="py-2">
                      <Link
                        to={`/teams/${s.team.id}`}
                        className="inline-flex items-center gap-2 text-text-secondary hover:text-brand focus-ring rounded-xs"
                      >
                        <TeamBadge team={s.team} size="xs" /> {s.team.shortName}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-bold tabular">
                      {s.goals}
                    </td>
                    <td className="py-2 pr-3 text-right tabular text-text-secondary">
                      {s.assists}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
