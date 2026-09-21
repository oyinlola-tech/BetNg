import type { CrestSize } from "@betng/design-tokens";
import { cn } from "../lib/cn";
import { TeamCrest } from "./TeamCrest";
import type { TeamCrestTeam } from "./TeamCrest";

export interface TeamAvatarProps {
  readonly team: TeamCrestTeam;
  readonly size?: "sm" | "md" | "lg";
  readonly decorative?: boolean;
  readonly className?: string;
}

const TILES: Readonly<Record<NonNullable<TeamAvatarProps["size"]>, { readonly tile: string; readonly crest: CrestSize }>> = {
  sm: { tile: "size-8", crest: 20 },
  md: { tile: "size-10", crest: 24 },
  lg: { tile: "size-14", crest: 40 },
};

export function TeamAvatar({ team, size = "md", decorative = false, className }: TeamAvatarProps): React.JSX.Element {
  const spec = TILES[size];

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-sm border border-border bg-surface-sunken", spec.tile, className)}>
      <TeamCrest team={team} size={spec.crest} decorative={decorative} />
    </span>
  );
}
