import { Link } from "react-router";
import type { StandingRow, StandingsView } from "@betng/ui-core";
import { TONE_TEXT } from "../domain/tone";
import { cn } from "../lib/cn";
import { TeamCrest } from "../teams";
import { EmptyState } from "../ui";
import { FormPips } from "./FormPips";
import { StandingsCards } from "./StandingsCards";
import { rowZone, signedDifference } from "./standingsZone";

export type LeagueTableDensity = "full" | "compact" | "tv";

const DENSITY = {
  full: { cell: "py-2", text: "type-data", crest: 20, head: "type-caption" },
  compact: { cell: "py-2", text: "type-data", crest: 20, head: "type-caption" },
  tv: { cell: "py-4", text: "type-h2 tabular", crest: 48, head: "type-section" },
} as const;

const COLUMNS: readonly {
  readonly key: string;
  readonly abbr: string;
  readonly title: string;
  readonly value: (row: StandingRow) => number | string;
  readonly detail: boolean;
}[] = [
  { key: "played", abbr: "P", title: "Played", value: (r) => r.played, detail: false },
  { key: "won", abbr: "W", title: "Won", value: (r) => r.won, detail: true },
  { key: "drawn", abbr: "D", title: "Drawn", value: (r) => r.drawn, detail: true },
  { key: "lost", abbr: "L", title: "Lost", value: (r) => r.lost, detail: true },
  { key: "goalsFor", abbr: "GF", title: "Goals for", value: (r) => r.goalsFor, detail: true },
  { key: "goalsAgainst", abbr: "GA", title: "Goals against", value: (r) => r.goalsAgainst, detail: true },
  {
    key: "goalDifference",
    abbr: "GD",
    title: "Goal difference",
    value: (r) => signedDifference(r.goalDifference),
    detail: false,
  },
];

export interface LeagueTableProps {
  readonly standings: StandingsView;
  /** @deprecated Use `density="compact"`. */
  readonly compact?: boolean;
  readonly density?: LeagueTableDensity;
  readonly highlightTeamIds?: readonly string[];
  /** Defaults to `/teams/:id`. Pass `null` for a table without links (TV). */
  readonly teamHref?: ((row: StandingRow) => string) | null | undefined;
  /** Below `sm` the table becomes cards. Off for compact and TV tables. */
  readonly responsive?: boolean | undefined;
  readonly caption?: string;
  readonly className?: string | undefined;
}

function defaultTeamHref(row: StandingRow): string {
  return `/teams/${row.team.id}`;
}

export function LeagueTable({
  standings,
  compact = false,
  density,
  highlightTeamIds = [],
  teamHref,
  responsive,
  caption = "League table",
  className,
}: LeagueTableProps): React.JSX.Element {
  const mode: LeagueTableDensity = density ?? (compact ? "compact" : "full");
  const spec = DENSITY[mode];
  const detailed = mode !== "compact";
  const href =
    teamHref === null || mode === "tv" ? undefined : (teamHref ?? defaultTeamHref);
  const cards = responsive ?? mode === "full";

  if (standings.rows.length === 0) {
    return (
      <EmptyState
        compact
        title="No standings yet"
        description="The table appears once the platform publishes it."
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      {cards && (
        <StandingsCards
          standings={standings}
          highlightTeamIds={highlightTeamIds}
          teamHref={href}
          className="sm:hidden"
        />
      )}
      <div className={cn("overflow-x-auto scrollbar-thin", cards && "max-sm:hidden")}>
        <table className={cn("w-full", mode === "full" && "min-w-[36rem]")}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className={cn(spec.head, "border-b border-border text-left")}>
              <th scope="col" className="w-10 py-2 pl-3">
                <abbr title="Position" className="no-underline">
                  #
                </abbr>
              </th>
              <th scope="col" className="py-2">
                Team
              </th>
              {COLUMNS.filter((c) => detailed || !c.detail).map((column) => (
                <th key={column.key} scope="col" className="w-10 py-2 text-right">
                  <abbr title={column.title} className="no-underline">
                    {column.abbr}
                  </abbr>
                </th>
              ))}
              <th scope="col" className="w-12 py-2 pr-3 text-right">
                <abbr title="Points" className="no-underline">
                  Pts
                </abbr>
              </th>
              {detailed && (
                <th scope="col" className="w-28 py-2 pr-3 text-right">
                  Form
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row) => {
              const zone = rowZone(row);
              const highlighted = highlightTeamIds.includes(row.team.id);
              const link = href?.(row);
              const team = (
                <>
                  <TeamCrest team={row.team} size={spec.crest} decorative />
                  <span className="truncate">
                    {mode === "compact" ? row.team.shortName : row.team.name}
                  </span>
                </>
              );

              return (
                <tr
                  key={row.team.id}
                  data-highlighted={highlighted || undefined}
                  className={cn(
                    "border-b border-border last:border-0",
                    mode !== "tv" &&
                      "transition-colors duration-[var(--bn-duration-fast)] hover:bg-surface-hover",
                    highlighted && "bg-brand-subtle",
                  )}
                >
                  <td className={cn(spec.cell, spec.text, "pl-3 pr-2 text-text-muted")}>
                    {row.position}
                  </td>
                  <th
                    scope="row"
                    className={cn(spec.cell, spec.text, "text-left font-semibold text-text-primary")}
                  >
                    {link === undefined ? (
                      <span className="inline-flex max-w-full items-center gap-2">
                        {team}
                      </span>
                    ) : (
                      <Link
                        to={link}
                        className="inline-flex max-w-full items-center gap-2 rounded-xs hover:text-brand focus-ring"
                      >
                        {team}
                      </Link>
                    )}
                    {zone !== undefined && (
                      <span
                        className={cn(
                          "type-small ml-2 font-normal",
                          TONE_TEXT[zone.tone ?? "neutral"],
                        )}
                      >
                        {zone.label}
                      </span>
                    )}
                  </th>
                  {COLUMNS.filter((c) => detailed || !c.detail).map((column) => (
                    <td
                      key={column.key}
                      className={cn(spec.cell, spec.text, "text-right text-text-secondary")}
                    >
                      {column.value(row)}
                    </td>
                  ))}
                  <td
                    className={cn(spec.cell, spec.text, "pr-3 text-right font-bold text-text-primary")}
                  >
                    {row.points}
                  </td>
                  {detailed && (
                    <td className={cn(spec.cell, "pr-3 text-right")}>
                      <FormPips form={row.form} size={mode === "tv" ? "lg" : "sm"} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
