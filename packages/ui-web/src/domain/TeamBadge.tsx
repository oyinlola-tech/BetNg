import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";

export interface TeamBadgeProps {
  readonly team: Pick<TeamView, "code" | "colors" | "name">;
  readonly size?: "xs" | "sm" | "md" | "lg" | "xl";
  readonly className?: string;
}

const SIZES = {
  xs: "size-5 text-[8px]",
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
};

export function TeamBadge({
  team,
  size = "sm",
  className,
}: TeamBadgeProps): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={team.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold tracking-wide select-none",
        SIZES[size],
        className,
      )}
      style={{
        background: team.colors.primary,
        color: team.colors.onPrimary,
        boxShadow: `inset 0 0 0 2px ${team.colors.secondary}40`,
      }}
    >
      {team.code}
    </span>
  );
}
