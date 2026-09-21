import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface MatchSkeletonProps {
  readonly markets?: boolean;
  readonly className?: string;
}

export function MatchSkeleton({
  markets = false,
  className,
}: MatchSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot
      label="Loading match"
      className={cn("block rounded-md border border-border bg-surface p-4", className)}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="mt-4 space-y-3">
        {[0, 1].map((side) => (
          <div key={side} className="flex items-center gap-3">
            <Skeleton className="size-7 rounded-xs" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="size-6" />
          </div>
        ))}
      </div>
      {markets && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}
    </SkeletonRoot>
  );
}

export const MatchCardSkeleton: (
  props: MatchSkeletonProps,
) => React.JSX.Element = MatchSkeleton;
