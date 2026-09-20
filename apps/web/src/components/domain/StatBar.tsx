import type { MatchStats, MatchSummary, SideStats } from "@betng/ui-core";
import { cn } from "../../lib/cn";
import { EmptyState } from "../ui/States";

export interface StatBarProps {
  readonly label: string;
  readonly home: number;
  readonly away: number;
  readonly percent?: boolean;
}

export function StatBar({
  label,
  home,
  away,
  percent = false,
}: StatBarProps): React.JSX.Element {
  const total = home + away;
  const homeShare = total === 0 ? 50 : (home / total) * 100;
  const homeLeads = home > away;
  const awayLeads = away > home;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span
          className={cn(
            "tabular font-semibold",
            homeLeads ? "text-text-primary" : "text-text-muted",
          )}
        >
          {home}
          {percent ? "%" : ""}
        </span>
        <span className="caps-label">{label}</span>
        <span
          className={cn(
            "tabular font-semibold",
            awayLeads ? "text-text-primary" : "text-text-muted",
          )}
        >
          {away}
          {percent ? "%" : ""}
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 gap-0.5">
        <div className="flex-1 overflow-hidden rounded-l-full bg-surface-sunken">
          <div
            className={cn(
              "ml-auto h-full rounded-l-full transition-[width] duration-500",
              homeLeads ? "bg-brand" : "bg-border-strong",
            )}
            style={{ width: `${String(homeShare)}%` }}
          />
        </div>
        <div className="flex-1 overflow-hidden rounded-r-full bg-surface-sunken">
          <div
            className={cn(
              "h-full rounded-r-full transition-[width] duration-500",
              awayLeads ? "bg-brand" : "bg-border-strong",
            )}
            style={{ width: `${String(100 - homeShare)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const ROWS: readonly {
  readonly key: keyof SideStats;
  readonly label: string;
  readonly percent?: boolean;
}[] = [
  { key: "possession", label: "Possession", percent: true },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "On target" },
  { key: "corners", label: "Corners" },
  { key: "fouls", label: "Fouls" },
  { key: "offsides", label: "Offsides" },
  { key: "yellowCards", label: "Yellow cards" },
  { key: "redCards", label: "Red cards" },
];

export function StatsPanel({
  match,
  stats,
  className,
}: {
  readonly match: MatchSummary;
  readonly stats: MatchStats | undefined;
  readonly className?: string;
}): React.JSX.Element {
  if (stats === undefined) {
    return (
      <EmptyState
        compact
        title="Statistics not available yet"
        description="They start once the match kicks off."
        className={className}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{match.home.shortName}</span>
        <span>{match.away.shortName}</span>
      </div>
      {ROWS.map((row) => (
        <StatBar
          key={row.key}
          label={row.label}
          home={stats.home[row.key]}
          away={stats.away[row.key]}
          percent={row.percent ?? false}
        />
      ))}
    </div>
  );
}
