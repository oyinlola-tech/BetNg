import type { TeamView } from "@betng/ui-core";
import { cn } from "../lib/cn";

export function TeamMark({
  team,
  size = "md",
  className,
}: {
  readonly team: Pick<TeamView, "code" | "colors" | "name">;
  readonly size?: "sm" | "md" | "lg" | "xl";
  readonly className?: string;
}): React.JSX.Element {
  const dims = {
    sm: "size-[1.6rem] text-[0.6rem]",
    md: "size-[2.4rem] text-[0.85rem]",
    lg: "size-[3.6rem] text-[1.2rem]",
    xl: "size-[5.5rem] text-[1.8rem]",
  }[size];

  return (
    <span
      role="img"
      aria-label={team.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-display font-black tracking-wider",
        dims,
        className,
      )}
      style={{
        background: team.colors.primary,
        color: team.colors.onPrimary,
        boxShadow: `inset 0 0 0 0.15rem ${team.colors.secondary}55`,
      }}
    >
      {team.code}
    </span>
  );
}
