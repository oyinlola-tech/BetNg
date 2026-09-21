import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface MarketSkeletonProps {
  readonly markets?: number;
  readonly className?: string;
}

const COLUMNS = ["grid-cols-3", "grid-cols-2", "grid-cols-3", "grid-cols-2"] as const;

export function MarketSkeleton({
  markets = 3,
  className,
}: MarketSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading markets" className={cn("block space-y-3", className)}>
      {Array.from({ length: markets }, (_, m) => {
        const columns = COLUMNS[m % COLUMNS.length] ?? "grid-cols-3";

        return (
          <div key={m} className="rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="size-4" />
            </div>
            <div className={cn("grid gap-2 p-3", columns)}>
              {Array.from({ length: columns === "grid-cols-3" ? 3 : 4 }, (_, s) => (
                <Skeleton key={s} className="h-10" />
              ))}
            </div>
          </div>
        );
      })}
    </SkeletonRoot>
  );
}
