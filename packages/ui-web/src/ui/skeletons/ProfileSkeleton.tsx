import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface ProfileSkeletonProps {
  readonly fields?: number;
  readonly className?: string;
}

export function ProfileSkeleton({
  fields = 4,
  className,
}: ProfileSkeletonProps): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading profile" className={cn("block space-y-4", className)}>
      <div className="flex items-center gap-4 rounded-md border border-border bg-surface p-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="hidden h-8 w-24 sm:block" />
      </div>
      <div className="rounded-md border border-border bg-surface p-4">
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10" />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </SkeletonRoot>
  );
}
