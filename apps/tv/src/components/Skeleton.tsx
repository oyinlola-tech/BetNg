import { cn } from "../lib/cn";

export function Skeleton({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div aria-hidden className={cn("skeleton h-[1.2rem] w-full", className)} />
  );
}
