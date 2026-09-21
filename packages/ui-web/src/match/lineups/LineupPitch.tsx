import type { LineupPlayer, TeamLineup, TeamView } from "@betng/ui-core";
import { cn } from "../../lib/cn";
import { PlayerCard } from "./PlayerCard";
import { PlayerRow } from "./PlayerRow";

export interface LineupPitchProps {
  readonly lineup: TeamLineup;
  readonly team: TeamView;
  /** The goalkeeper's end. */
  readonly attack?: "down" | "up";
  readonly className?: string | undefined;
}

type GridPlayer = LineupPlayer & {
  readonly grid: NonNullable<LineupPlayer["grid"]>;
};

function gridRows(
  players: readonly LineupPlayer[],
): readonly (readonly GridPlayer[])[] | undefined {
  const placed = players.filter(
    (player): player is GridPlayer => player.grid !== undefined,
  );

  if (placed.length === 0 || placed.length !== players.length) return undefined;

  const rows = new Map<number, GridPlayer[]>();

  for (const player of placed) {
    rows.set(player.grid.row, [...(rows.get(player.grid.row) ?? []), player]);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => [...row].sort((a, b) => a.grid.slot - b.grid.slot));
}

export function LineupPitch({
  lineup,
  team,
  attack = "down",
  className,
}: LineupPitchProps): React.JSX.Element {
  const rows = gridRows(lineup.starting);

  if (rows === undefined) {
    return (
      <ul
        aria-label={`${team.name} starting lineup`}
        className={cn("divide-y divide-border", className)}
      >
        {lineup.starting.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </ul>
    );
  }

  const ordered = attack === "down" ? rows : [...rows].reverse();

  return (
    <div
      role="group"
      aria-label={`${team.name} formation${lineup.formation === undefined ? "" : ` ${lineup.formation}`}`}
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-surface-sunken",
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 130"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full fill-none stroke-border-strong"
        strokeWidth="0.6"
      >
        <rect x="4" y="4" width="92" height="122" />
        <g transform={attack === "down" ? undefined : "rotate(180 50 65)"}>
          <rect x="26" y="4" width="48" height="20" />
          <rect x="38" y="4" width="24" height="8" />
          <path d="M40 24 A11 11 0 0 0 60 24" />
          <path d="M34 126 A16 16 0 0 1 66 126" />
        </g>
      </svg>
      <div className="relative flex min-h-80 flex-col justify-around gap-3 px-2 py-5">
        {ordered.map((row) => (
          <div
            key={row[0]?.grid.row}
            className="flex items-start justify-around gap-1"
          >
            {row.map((player) => (
              <PlayerCard key={player.id} player={player} team={team} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
