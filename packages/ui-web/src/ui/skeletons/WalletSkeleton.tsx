import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface WalletSkeletonProps {
  readonly transactions?: number;
  readonly className?: string;
}

export function WalletSkeleton({
  transactions = 5,
  className,
}: WalletSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading wallet" className={cn("block space-y-4", className)}>
      <div className="rounded-md border border-border bg-surface p-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-9 w-48" />
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      <div className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: transactions }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <Skeleton className="size-8 rounded-sm" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </SkeletonRoot>
  );
}
