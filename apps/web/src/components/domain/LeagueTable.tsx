import { Link } from "react-router";
import type { FormResult, StandingRow, StandingsView } from "@betng/ui-core";
import { cn } from "../../lib/cn";
import { TeamBadge } from "./TeamBadge";

export function FormPips({ form, className }: { readonly form: readonly FormResult[]; readonly className?: string }): React.JSX.Element {
  return (
    <span className={cn("inline-flex gap-0.5", className)} aria-label={`Form: ${form.join(" ")}`}>
      {form.length === 0 && <span className="text-xs text-text-muted">–</span>}
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-xs text-[9px] font-bold",
            r === "W" && "bg-success text-white",
            r === "D" && "bg-border-strong text-text-primary",
            r === "L" && "bg-danger text-white",
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export interface LeagueTableProps {
  readonly standings: StandingsView;
  readonly compact?: boolean;
  readonly highlightTeamIds?: readonly string[];
  readonly className?: string;
}

export function LeagueTable({ standings, compact = false, highlightTeamIds = [], className }: LeagueTableProps): React.JSX.Element {
  return (
    <div className={cn("overflow-x-auto scrollbar-thin", className)}>
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="caps-label border-b border-border text-left">
            <th className="w-8 py-2 pl-3 font-semibold">#</th>
            <th className="py-2 font-semibold">Team</th>
            <th className="w-8 py-2 text-right font-semibold">P</th>
            {!compact && (
              <>
                <th className="w-8 py-2 text-right font-semibold">W</th>
                <th className="w-8 py-2 text-right font-semibold">D</th>
                <th className="w-8 py-2 text-right font-semibold">L</th>
                <th className="w-10 py-2 text-right font-semibold">GF</th>
                <th className="w-10 py-2 text-right font-semibold">GA</th>
              </>
            )}
            <th className="w-10 py-2 text-right font-semibold">GD</th>
            <th className="w-12 py-2 pr-3 text-right font-semibold">Pts</th>
            {!compact && <th className="w-28 py-2 pr-3 text-right font-semibold">Form</th>}
          </tr>
        </thead>
        <tbody>
          {standings.rows.map((row) => (
            <Row key={row.team.id} row={row} compact={compact} total={standings.rows.length} highlighted={highlightTeamIds.includes(row.team.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, compact, total, highlighted }: { readonly row: StandingRow; readonly compact: boolean; readonly total: number; readonly highlighted: boolean }): React.JSX.Element {
  const top = row.position <= 2;
  const bottom = row.position > total - 2;

  return (
    <tr className={cn("border-b border-border last:border-0 transition-colors hover:bg-surface-hover", highlighted && "bg-brand-subtle/50")}>
      <td className="py-2 pl-3">
        <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-xs text-xs font-bold tabular", top && "bg-brand-subtle text-brand", bottom && "bg-danger-subtle text-danger", !top && !bottom && "text-text-muted")}>
          {row.position}
        </span>
      </td>
      <td className="py-2">
        <Link to={`/teams/${row.team.id}`} className="inline-flex items-center gap-2 rounded-xs font-medium hover:text-brand focus-ring">
          <TeamBadge team={row.team} size="xs" />
          <span className="truncate">{compact ? row.team.shortName : row.team.name}</span>
        </Link>
      </td>
      <td className="py-2 text-right tabular text-text-secondary">{row.played}</td>
      {!compact && (
        <>
          <td className="py-2 text-right tabular text-text-secondary">{row.won}</td>
          <td className="py-2 text-right tabular text-text-secondary">{row.drawn}</td>
          <td className="py-2 text-right tabular text-text-secondary">{row.lost}</td>
          <td className="py-2 text-right tabular text-text-secondary">{row.goalsFor}</td>
          <td className="py-2 text-right tabular text-text-secondary">{row.goalsAgainst}</td>
        </>
      )}
      <td className="py-2 text-right tabular text-text-secondary">{row.goalDifference > 0 ? `+${String(row.goalDifference)}` : row.goalDifference}</td>
      <td className="py-2 pr-3 text-right font-bold tabular">{row.points}</td>
      {!compact && (
        <td className="py-2 pr-3 text-right">
          <FormPips form={row.form} />
        </td>
      )}
    </tr>
  );
}
