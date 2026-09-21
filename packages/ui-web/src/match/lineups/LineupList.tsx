import type { TeamLineup, TeamView } from "@betng/ui-core";
import { Formation } from "../../icons";
import { cn } from "../../lib/cn";
import { TeamCrest } from "../../teams";
import { PlayerRow } from "./PlayerRow";

export interface LineupListProps {
  readonly lineup: TeamLineup;
  readonly team: TeamView;
  readonly showHeader?: boolean;
  readonly className?: string | undefined;
}

export function LineupList({
  lineup,
  team,
  showHeader = true,
  className,
}: LineupListProps): React.JSX.Element {
  return (
    <section aria-label={`${team.name} lineup`} className={cn("min-w-0", className)}>
      {showHeader && (
        <header className="mb-2 flex items-center gap-2">
          <TeamCrest team={team} size={24} decorative />
          <h4 className="type-h3 min-w-0 flex-1 truncate">{team.name}</h4>
          {lineup.formation !== undefined && (
            <span className="type-data inline-flex items-center gap-1 text-text-secondary">
              <Formation size={14} title="Formation" />
              {lineup.formation}
            </span>
          )}
        </header>
      )}
      {lineup.starting.length > 0 && (
        <>
          <h5 className="type-caption mt-3">Starting XI</h5>
          <ul className="divide-y divide-border">
            {lineup.starting.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </ul>
        </>
      )}
      {lineup.substitutes.length > 0 && (
        <>
          <h5 className="type-caption mt-4">Substitutes</h5>
          <ul className="divide-y divide-border">
            {lineup.substitutes.map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </ul>
        </>
      )}
      {lineup.manager !== undefined && (
        <p className="type-small mt-4 text-text-secondary">
          <span className="type-caption mr-2">Manager</span>
          {lineup.manager}
        </p>
      )}
    </section>
  );
}
