import type { CrestSize } from "@betng/design-tokens";
import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";

export type TeamBadgeSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface TeamBadgeProps {
  readonly team: Pick<TeamView, "id" | "name" | "code" | "colors" | "crest">;
  readonly size?: TeamBadgeSize;
  readonly showCode?: boolean;
  readonly className?: string;
}

const SIZES: Readonly<Record<TeamBadgeSize, { readonly crest: CrestSize; readonly code: string }>> = {
  xs: { crest: 20, code: "text-xs" },
  sm: { crest: 24, code: "text-xs" },
  md: { crest: 32, code: "text-sm" },
  lg: { crest: 48, code: "text-base" },
  xl: { crest: 64, code: "text-md" },
};

export function TeamBadge({ team, size = "sm", showCode = false, className }: TeamBadgeProps): React.JSX.Element {
  const spec = SIZES[size];

  if (!showCode) return <TeamCrest team={team} size={spec.crest} {...(className !== undefined && { className })} />;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 align-middle", className)}>
      <TeamCrest team={team} size={spec.crest} decorative />
      <abbr title={team.name} className={cn("font-display font-bold tracking-wide text-text-primary no-underline", spec.code)}>
        {team.code}
      </abbr>
    </span>
  );
}
