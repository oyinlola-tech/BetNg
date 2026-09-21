import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface BetSlipSkeletonProps {
  readonly selections?: number;
  readonly className?: string;
}

export function BetSlipSkeleton({
  selections = 2,
  className,
}: BetSlipSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading bet slip" className={cn("block", className)}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-6" />
      </div>
      {Array.from({ length: selections }, (_, i) => (
        <div key={i} className="space-y-2 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="size-4" />
          </div>
          <Skeleton className="h-3 w-2/5" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-10" />
          </div>
        </div>
      ))}
      <div className="space-y-3 px-4 py-4">
        <Skeleton className="h-10" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-12" />
      </div>
    </SkeletonRoot>
  );
}
