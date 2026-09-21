import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface PageSkeletonProps {
  readonly cards?: number;
  readonly className?: string;
}

export function PageSkeleton({
  cards = 6,
  className,
}: PageSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading page" className={cn("block space-y-8", className)}>
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="rounded-md border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="mt-4 space-y-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}
