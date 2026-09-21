import { cn } from "../lib/cn";

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  readonly title?: string;
  readonly description?: string;
  readonly actions?: React.ReactNode;
  readonly flush?: boolean;
}

export function Panel({ title, description, actions, flush = false, className, children, ...rest }: PanelProps): React.JSX.Element {
  return (
    <section className={cn("rounded-md border border-border bg-surface", className)} {...rest}>
      {(title !== undefined || actions !== undefined) && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="min-w-0">
            {title !== undefined && <h2 className="truncate text-base font-semibold text-text-primary">{title}</h2>}
            {description !== undefined && <p className="truncate text-sm text-text-muted">{description}</p>}
          </div>
          {actions !== undefined && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "p-4")}>{children}</div>
    </section>
  );
}
