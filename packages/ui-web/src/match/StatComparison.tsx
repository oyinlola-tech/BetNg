import { cn } from "../lib/cn";
import { formatStat, type StatUnit } from "./statRows";

export interface StatComparisonProps {
  readonly label: string;
  readonly home: number | undefined;
  readonly away: number | undefined;
  readonly unit?: StatUnit;
  readonly dense?: boolean;
  readonly className?: string | undefined;
}

export function StatComparison({
  label,
  home,
  away,
  unit = "COUNT",
  dense = false,
  className,
}: StatComparisonProps): React.JSX.Element {
  const comparable = home !== undefined && away !== undefined;
  const homeLeads = comparable && home > away;
  const awayLeads = comparable && away > home;

  return (
    <div
      className={cn(
        "grid grid-cols-[3rem_1fr_3rem] items-center gap-2",
        dense ? "py-1" : "py-2",
        className,
      )}
    >
      <span
        className={cn(
          "type-data text-left",
          homeLeads ? "font-bold text-text-primary" : "text-text-secondary",
        )}
      >
        {formatStat(home, unit)}
      </span>
      <span className="type-caption text-center">{label}</span>
      <span
        className={cn(
          "type-data text-right",
          awayLeads ? "font-bold text-text-primary" : "text-text-secondary",
        )}
      >
        {formatStat(away, unit)}
      </span>
    </div>
  );
}
