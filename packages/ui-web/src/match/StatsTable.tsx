import type { MatchStats } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { formatStat, statRows } from "./statRows";

export interface StatsTableProps {
  readonly stats: MatchStats;
  readonly homeLabel: string;
  readonly awayLabel: string;
  readonly caption?: string;
  readonly only?: readonly string[] | undefined;
  readonly className?: string | undefined;
}

export function StatsTable({
  stats,
  homeLabel,
  awayLabel,
  caption = "Match statistics",
  only,
  className,
}: StatsTableProps): React.JSX.Element {
  const rows = statRows(stats, only);

  return (
    <table className={cn("w-full", className)}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="type-caption py-2 text-left">
            Statistic
          </th>
          <th scope="col" className="type-caption w-20 py-2 text-right">
            {homeLabel}
          </th>
          <th scope="col" className="type-caption w-20 py-2 text-right">
            {awayLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const comparable = row.home !== undefined && row.away !== undefined;
          const homeLeads = comparable && row.home > row.away;
          const awayLeads = comparable && row.away > row.home;

          return (
            <tr key={row.key} className="border-b border-border last:border-0">
              <th
                scope="row"
                className="type-small py-2 text-left font-medium text-text-secondary"
              >
                {row.label}
              </th>
              <td
                className={cn(
                  "type-data py-2 text-right",
                  homeLeads
                    ? "font-bold text-text-primary"
                    : "text-text-secondary",
                )}
              >
                {formatStat(row.home, row.unit)}
              </td>
              <td
                className={cn(
                  "type-data py-2 text-right",
                  awayLeads
                    ? "font-bold text-text-primary"
                    : "text-text-secondary",
                )}
              >
                {formatStat(row.away, row.unit)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
