import { useId } from "react";
import { SectionHeading } from "../domain/SectionHeading";
import { cn } from "../lib/cn";

export interface MarketGroupProps {
  readonly title: string;
  readonly count?: number | undefined;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string | undefined;
}

export function MarketGroup({
  title,
  count,
  action,
  children,
  className,
}: MarketGroupProps): React.JSX.Element {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", className)}>
      <SectionHeading as="h3" id={headingId} action={action}>
        {title}
        {count !== undefined && (
          <span className="ml-1.5 tabular text-text-muted">{count}</span>
        )}
      </SectionHeading>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}
