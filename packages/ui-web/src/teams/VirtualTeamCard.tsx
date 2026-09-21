import { Link } from "react-router";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";

export interface VirtualTeamCardProps {
  readonly team: Pick<TeamView, "id" | "name" | "city" | "colors" | "crest">;
  readonly leagueName?: string;
  readonly form?: React.ReactNode;
  readonly to?: string;
  readonly className?: string;
}

export function VirtualTeamCard({ team, leagueName, form, to, className }: VirtualTeamCardProps): React.JSX.Element {
  const body = (
    <>
      <TeamCrest team={team} size={64} decorative />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {leagueName !== undefined && <span className="type-caption truncate">{leagueName}</span>}
        <span className="type-h3 truncate text-text-primary">{team.name}</span>
        {team.city !== "" && <span className="type-small truncate text-text-secondary">{team.city}</span>}
        {form !== undefined && <div className="mt-2 flex items-center gap-1">{form}</div>}
      </div>
    </>
  );
  const frame = cn("flex min-w-0 items-center gap-4 rounded-md border border-border bg-surface p-4", className);

  if (to === undefined) return <article className={frame}>{body}</article>;

  return (
    <Link to={to} className={cn(frame, "transition-colors hover:border-border-strong hover:bg-surface-hover focus-ring")}>
      {body}
    </Link>
  );
}
