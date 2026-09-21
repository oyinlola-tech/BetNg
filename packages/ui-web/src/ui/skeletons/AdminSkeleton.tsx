import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface AdminSkeletonProps {
  readonly kpis?: number;
  readonly rows?: number;
  readonly columns?: number;
  readonly className?: string;
}

export function AdminSkeleton({
  kpis = 4,
  rows = 8,
  columns = 6,
  className,
}: AdminSkeletonProps): React.JSX.Element {
  const template = {
    gridTemplateColumns: `repeat(${String(Math.max(1, columns))}, minmax(0, 1fr))`,
  };

  return (
    <SkeletonRoot label="Loading dashboard" className={cn("block space-y-4", className)}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: kpis }, (_, i) => (
          <div key={i} className="rounded-md border border-border bg-surface p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid gap-4 border-b border-border px-3 py-2.5" style={template}>
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className="grid gap-4 border-b border-border px-3 py-3 last:border-b-0"
            style={template}
          >
            {Array.from({ length: columns }, (_, c) => (
              <Skeleton key={c} className={cn("h-4", (r + c) % 2 === 0 ? "w-3/4" : "w-1/2")} />
            ))}
          </div>
        ))}
      </div>
    </SkeletonRoot>
  );
}
