import { cn } from "../lib/cn";

export interface SectionHeadingProps {
  readonly children: React.ReactNode;
  readonly as?: "h2" | "h3";
  readonly action?: React.ReactNode;
  readonly id?: string | undefined;
  readonly className?: string | undefined;
}

export function SectionHeading({
  children,
  as: Tag = "h2",
  action,
  id,
  className,
}: SectionHeadingProps): React.JSX.Element {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Tag id={id} className="type-section flex min-w-0 items-center gap-2">
        <span aria-hidden className="h-3 w-0.5 shrink-0 bg-brand" />
        <span className="truncate">{children}</span>
      </Tag>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}
