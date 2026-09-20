import { cn } from "../lib/cn";

export function Skeleton({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} />;
}

export function SkeletonRows({
  rows = 4,
  className,
}: {
  readonly rows?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div className={cn("space-y-3", className)} aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function MatchCardSkeleton(): React.JSX.Element {
  return (
    <div
      className="rounded-md border border-border bg-surface p-4"
      aria-busy
      aria-label="Loading match"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-10" />
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
