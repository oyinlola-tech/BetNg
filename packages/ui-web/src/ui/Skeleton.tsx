import { cn } from "../lib/cn";

export function Skeleton({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} />;
}

export interface SkeletonRootProps {
  readonly label?: string;
  readonly className?: string | undefined;
  readonly children: React.ReactNode;
}

/** One announced status per skeleton; the shapes themselves stay hidden from assistive technology. */
export function SkeletonRoot({
  label = "Loading",
  className,
  children,
}: SkeletonRootProps): React.JSX.Element {
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="contents">
        {children}
      </div>
    </div>
  );
}

export function SkeletonRows({
  rows = 4,
  className,
}: {
  readonly rows?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <SkeletonRoot className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </SkeletonRoot>
  );
}
