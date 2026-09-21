import { cn } from "../lib/cn";
import { Skeleton } from "../ui";
import {
  MATCH_CARD_VARIANTS,
  type MatchCardVariant,
} from "./matchCardVariants";

export interface MatchCardSkeletonProps {
  readonly variant?: MatchCardVariant;
  readonly className?: string | undefined;
}

export function MatchCardSkeleton({
  variant = "standard",
  className,
}: MatchCardSkeletonProps): React.JSX.Element {
  const spec = MATCH_CARD_VARIANTS[variant];
  const row = spec.layout === "row";

  return (
    <div
      role="status"
      aria-busy
      aria-label="Loading match"
      className={cn(spec.root, spec.main, row && "flex items-center gap-3", className)}
    >
      {row ? (
        <Skeleton className="h-5 w-16 shrink-0" />
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-14" />
        </div>
      )}
      <div className={cn("min-w-0 flex-1", spec.teamGap)}>
        <TeamLine />
        <TeamLine />
      </div>
    </div>
  );
}

function TeamLine(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-5 shrink-0 rounded-xs" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-5 shrink-0" />
    </div>
  );
}
