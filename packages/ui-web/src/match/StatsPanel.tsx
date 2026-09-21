import type { MatchStats, MatchSummary } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { EmptyState } from "../ui";
import { Possession } from "../icons";
import { StatBar } from "./StatBar";
import { StatComparison } from "./StatComparison";
import { StatGrid } from "./StatGrid";
import { StatsTable } from "./StatsTable";
import { formatStat, statRows } from "./statRows";

export interface StatsPanelProps {
  readonly match: Pick<MatchSummary, "home" | "away">;
  readonly stats: MatchStats | undefined;
  readonly view?: "bars" | "table" | "grid";
  readonly className?: string | undefined;
}

export function StatsPanel({
  match,
  stats,
  view = "bars",
  className,
}: StatsPanelProps): React.JSX.Element {
  const rows = stats === undefined ? [] : statRows(stats);

  if (stats === undefined || rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Possession size={20} />}
        title="Statistics not available"
        description="The platform has not reported statistics for this match."
        className={className}
      />
    );
  }

  if (view === "table") {
    return (
      <StatsTable
        stats={stats}
        homeLabel={match.home.shortName}
        awayLabel={match.away.shortName}
        className={className}
      />
    );
  }

  if (view === "grid") {
    return (
      <StatGrid
        stats={stats}
        homeLabel={match.home.shortName}
        awayLabel={match.away.shortName}
        className={className}
      />
    );
  }

  return (
    <section aria-label="Match statistics" className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between type-small font-semibold text-text-primary">
        <span>{match.home.shortName}</span>
        <span>{match.away.shortName}</span>
      </div>
      {rows.map((row) =>
        row.home !== undefined && row.away !== undefined ? (
          <StatBar
            key={row.key}
            label={row.label}
            home={row.home}
            away={row.away}
            format={(value) => formatStat(value, row.unit)}
          />
        ) : (
          <StatComparison
            key={row.key}
            label={row.label}
            home={row.home}
            away={row.away}
            unit={row.unit}
            dense
          />
        ),
      )}
    </section>
  );
}
