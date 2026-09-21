import { cn } from "../../lib/cn";
import { Skeleton, SkeletonRoot } from "../Skeleton";

export interface TableSkeletonProps {
  readonly rows?: number;
  readonly columns?: number;
  readonly header?: boolean;
  readonly className?: string;
}

const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6"] as const;

export function TableSkeleton({
  rows = 6,
  columns = 5,
  header = true,
  className,
}: TableSkeletonProps): React.JSX.Element {
  const template = {
    gridTemplateColumns: `repeat(${String(Math.max(1, columns))}, minmax(0, 1fr))`,
  };

  return (
    <SkeletonRoot label="Loading table" className={cn("block", className)}>
      {header && (
        <div
          className="grid gap-4 border-b border-border px-3 py-2.5"
          style={template}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-3 w-16" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-border px-3 py-3 last:border-b-0"
          style={template}
        >
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn("h-4", WIDTHS[(r + c) % WIDTHS.length])} />
          ))}
        </div>
      ))}
    </SkeletonRoot>
  );
}
