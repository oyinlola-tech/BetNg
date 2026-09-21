import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface ShopSkeletonProps {
  readonly events?: number;
  readonly className?: string;
}

export function ShopSkeleton({
  events = 10,
  className,
}: ShopSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot
      label="Loading terminal"
      className={cn(
        "grid h-full min-h-0 grid-cols-1 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_22rem]",
        className,
      )}
    >
      <div className="hidden space-y-2 border-r border-border p-3 lg:block">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
      <div className="min-w-0 p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="mt-3 rounded-md border border-border bg-surface">
          {Array.from({ length: events }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
            >
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="hidden space-y-3 border-l border-border p-3 xl:block">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
        <Skeleton className="h-12" />
      </div>
    </SkeletonRoot>
  );
}
