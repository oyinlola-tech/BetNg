import { Link } from "react-router";
import type { CrestSize } from "@betng/design-tokens";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";

export interface TeamRowProps {
  readonly team: Pick<TeamView, "id" | "name" | "colors" | "crest">;
  readonly secondary?: React.ReactNode;
  readonly trailing?: React.ReactNode;
  readonly crestSize?: CrestSize;
  readonly to?: string;
  readonly className?: string;
}

export function TeamRow({ team, secondary, trailing, crestSize = 32, to, className }: TeamRowProps): React.JSX.Element {
  const identity = (
    <>
      <TeamCrest team={team} size={crestSize} decorative />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base font-semibold text-text-primary">{team.name}</span>
        {secondary !== undefined && <span className="type-small truncate text-text-muted">{secondary}</span>}
      </span>
    </>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {to !== undefined ? (
        <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 rounded-sm focus-ring hover:[&_span>span:first-child]:text-brand">
          {identity}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{identity}</div>
      )}
      {trailing !== undefined && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}
