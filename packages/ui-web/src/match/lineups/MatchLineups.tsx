import type { MatchLineupsView, TeamLineup, TeamView } from "@betng/ui-core";
import { ToneTag } from "../../domain/ToneTag";
import { Formation } from "../../icons";
import { cn } from "../../lib/cn";
import { TeamCrest } from "../../teams";
import { EmptyState, Skeleton } from "../../ui";
import { LineupList } from "./LineupList";
import { LineupPitch } from "./LineupPitch";

export interface MatchLineupsProps {
  readonly lineups: MatchLineupsView | undefined;
  readonly home: TeamView;
  readonly away: TeamView;
  readonly loading?: boolean;
  readonly showPitch?: boolean;
  readonly className?: string | undefined;
}

export function MatchLineups({
  lineups,
  home,
  away,
  loading = false,
  showPitch = true,
  className,
}: MatchLineupsProps): React.JSX.Element {
  if (loading) {
    return (
      <div
        role="status"
        aria-busy
        aria-label="Loading lineups"
        className={cn("grid gap-6 md:grid-cols-2", className)}
      >
        <SideSkeleton />
        <SideSkeleton />
      </div>
    );
  }

  if (
    lineups === undefined ||
    (lineups.home === undefined && lineups.away === undefined)
  ) {
    return (
      <EmptyState
        compact
        icon={<Formation size={20} />}
        title="Lineups not available"
        description="The platform has not published lineups for this match."
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      {!lineups.confirmed && (
        <p className="type-small mb-4 flex items-center gap-2 text-text-secondary">
          <ToneTag tone="pending">Predicted</ToneTag>
          Not yet confirmed
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Side lineup={lineups.home} team={home} showPitch={showPitch} attack="down" />
        <Side lineup={lineups.away} team={away} showPitch={showPitch} attack="down" />
      </div>
    </div>
  );
}

function Side({
  lineup,
  team,
  showPitch,
  attack,
}: {
  readonly lineup: TeamLineup | undefined;
  readonly team: TeamView;
  readonly showPitch: boolean;
  readonly attack: "down" | "up";
}): React.JSX.Element {
  if (lineup === undefined) {
    return (
      <section aria-label={`${team.name} lineup`} className="min-w-0">
        <header className="mb-2 flex items-center gap-2">
          <TeamCrest team={team} size={24} decorative />
          <h4 className="type-h3 min-w-0 truncate">{team.name}</h4>
        </header>
        <p className="type-small rounded-sm bg-surface-sunken px-3 py-4 text-text-muted">
          Lineup not available for {team.name}.
        </p>
      </section>
    );
  }

  const hasGrid =
    lineup.starting.length > 0 &&
    lineup.starting.every((player) => player.grid !== undefined);

  return (
    <div className="min-w-0 space-y-4">
      <LineupList lineup={lineup} team={team} />
      {showPitch && hasGrid && (
        <LineupPitch lineup={lineup} team={team} attack={attack} />
      )}
    </div>
  );
}

function SideSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
