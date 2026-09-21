import type { MatchStats } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { formatStat, statRows } from "./statRows";

export interface StatGridProps {
  readonly stats: MatchStats;
  readonly homeLabel: string;
  readonly awayLabel: string;
  /** Metric keys to show, in order. Every reported metric when omitted. */
  readonly only?: readonly string[] | undefined;
  readonly className?: string | undefined;
}

export function StatGrid({
  stats,
  homeLabel,
  awayLabel,
  only,
  className,
}: StatGridProps): React.JSX.Element {
  const rows = statRows(stats, only);

  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {rows.map((row) => {
        const comparable = row.home !== undefined && row.away !== undefined;
        const homeLeads = comparable && row.home > row.away;
        const awayLeads = comparable && row.away > row.home;

        return (
          <div key={row.key} className="rounded-sm bg-surface-sunken px-3 py-2.5">
            <dt className="type-caption truncate">{row.label}</dt>
            <dd className="mt-1.5 flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "type-data",
                  homeLeads
                    ? "font-bold text-text-primary"
                    : "text-text-secondary",
                )}
              >
                <span className="sr-only">{homeLabel} </span>
                {formatStat(row.home, row.unit)}
              </span>
              <span
                className={cn(
                  "type-data",
                  awayLeads
                    ? "font-bold text-text-primary"
                    : "text-text-secondary",
                )}
              >
                <span className="sr-only">{awayLabel} </span>
                {formatStat(row.away, row.unit)}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
