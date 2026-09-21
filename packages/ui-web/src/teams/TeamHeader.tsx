import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";

export interface TeamHeaderProps {
  readonly team: Pick<TeamView, "id" | "name" | "city" | "stadium" | "colors" | "crest">;
  readonly crestSize?: 80 | 96;
  readonly leagueMark?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

export function TeamHeader({ team, crestSize = 96, leagueMark, actions, className }: TeamHeaderProps): React.JSX.Element {
  const place = [team.city, team.stadium].filter((part) => part !== "");

  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6", className)}>
      <TeamCrest team={team} size={crestSize} decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {leagueMark !== undefined && <div className="flex items-center gap-2 type-caption">{leagueMark}</div>}
        <h1 className="type-h1 text-balance text-text-primary">{team.name}</h1>
        {place.length > 0 && (
          <p className="type-body text-text-secondary">
            {place.map((part, index) => (
              <span key={part}>
                {index > 0 && (
                  <span aria-hidden className="mx-2 text-text-muted">
                    ·
                  </span>
                )}
                {part}
              </span>
            ))}
          </p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
