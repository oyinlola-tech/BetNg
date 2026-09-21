import { Link } from "react-router";
import type { StandingRow, StandingsView } from "@betng/ui-core";
import { TONE_TEXT } from "../domain/tone";
import { cn } from "../lib/cn";
import { TeamCrest } from "../teams";
import { FormPips } from "./FormPips";
import { rowZone, signedDifference } from "./standingsZone";

export interface StandingsCardsProps {
  readonly standings: StandingsView;
  readonly highlightTeamIds?: readonly string[];
  readonly teamHref?: ((row: StandingRow) => string) | undefined;
  readonly className?: string | undefined;
}

export function StandingsCards({
  standings,
  highlightTeamIds = [],
  teamHref,
  className,
}: StandingsCardsProps): React.JSX.Element {
  return (
    <ol aria-label="League table" className={cn("divide-y divide-border", className)}>
      {standings.rows.map((row) => {
        const zone = rowZone(row);
        const href = teamHref?.(row);
        const name = (
          <>
            <TeamCrest team={row.team} size={24} decorative />
            <span className="type-body min-w-0 truncate font-semibold text-text-primary">
              {row.team.name}
            </span>
          </>
        );

        return (
          <li
            key={row.team.id}
            data-highlighted={highlightTeamIds.includes(row.team.id) || undefined}
            className={cn(
              "px-3 py-2.5",
              highlightTeamIds.includes(row.team.id) &&
                "border-l-2 border-l-brand bg-brand-subtle",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="type-data w-6 shrink-0 text-text-muted">
                {row.position}
              </span>
              {href === undefined ? (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {name}
                </span>
              ) : (
                <Link
                  to={href}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xs focus-ring"
                >
                  {name}
                </Link>
              )}
              <span className="type-data shrink-0 font-bold text-text-primary">
                {row.points}
                <span className="type-caption ml-1">Pts</span>
              </span>
            </div>
            <dl className="type-small mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 tabular text-text-secondary">
              <Stat label="Played" abbr="P" value={row.played} />
              <Stat label="Won" abbr="W" value={row.won} />
              <Stat label="Drawn" abbr="D" value={row.drawn} />
              <Stat label="Lost" abbr="L" value={row.lost} />
              <Stat
                label="Goal difference"
                abbr="GD"
                value={signedDifference(row.goalDifference)}
              />
              <FormPips form={row.form} className="ml-auto" />
            </dl>
            {zone !== undefined && (
              <p
                className={cn(
                  "type-small mt-1 pl-8",
                  TONE_TEXT[zone.tone ?? "neutral"],
                )}
              >
                {zone.label}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({
  label,
  abbr,
  value,
}: {
  readonly label: string;
  readonly abbr: string;
  readonly value: number | string;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-text-muted">
        <abbr title={label} className="no-underline">
          {abbr}
        </abbr>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
