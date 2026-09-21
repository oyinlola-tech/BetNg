import type { CrestSize } from "@betng/design-tokens";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";

export type TeamComparisonTeam = Pick<TeamView, "id" | "name" | "shortName" | "colors" | "crest">;

export interface TeamComparisonProps {
  readonly home: TeamComparisonTeam;
  readonly away: TeamComparisonTeam;
  readonly centre?: React.ReactNode;
  readonly orientation?: "horizontal" | "stacked";
  readonly crestSize?: CrestSize;
  readonly label?: "name" | "shortName";
  readonly className?: string;
}

interface SideProps {
  readonly team: TeamComparisonTeam;
  readonly side: "home" | "away";
  readonly stacked: boolean;
  readonly crestSize: CrestSize;
  readonly label: "name" | "shortName";
}

function Side({ team, side, stacked, crestSize, label }: SideProps): React.JSX.Element {
  const large = crestSize >= 64;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        !stacked && "flex-col text-center",
        !stacked && !large && (side === "home" ? "sm:flex-row-reverse sm:text-right" : "sm:flex-row sm:text-left"),
      )}
    >
      <TeamCrest team={team} size={crestSize} decorative />
      <span
        title={team.name}
        className={cn("min-w-0 max-w-full font-display font-bold text-text-primary", stacked ? "truncate" : "line-clamp-2 text-balance sm:truncate", large ? "text-lg" : "text-base")}
      >
        {team[label]}
      </span>
    </div>
  );
}

export function TeamComparison({ home, away, centre, orientation = "horizontal", crestSize = 48, label = "name", className }: TeamComparisonProps): React.JSX.Element {
  const stacked = orientation === "stacked";

  if (stacked) {
    return (
      <div role="group" aria-label={`${home.name} v ${away.name}`} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2", className)}>
        <Side team={home} side="home" stacked crestSize={crestSize} label={label} />
        {centre !== undefined && <div className="row-span-2 flex items-center justify-center">{centre}</div>}
        <Side team={away} side="away" stacked crestSize={crestSize} label={label} />
      </div>
    );
  }

  return (
    <div role="group" aria-label={`${home.name} v ${away.name}`} className={cn("grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6", className)}>
      <div className="flex min-w-0 justify-center sm:justify-end">
        <Side team={home} side="home" stacked={false} crestSize={crestSize} label={label} />
      </div>
      <div className="flex min-w-0 items-center justify-center">{centre}</div>
      <div className="flex min-w-0 justify-center sm:justify-start">
        <Side team={away} side="away" stacked={false} crestSize={crestSize} label={label} />
      </div>
    </div>
  );
}
