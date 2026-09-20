export interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: React.ReactNode;
  readonly eyebrow?: React.ReactNode;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow !== undefined && <div className="mb-1 text-sm text-text-muted">{eyebrow}</div>}
        <h1 className="font-display text-xl font-bold tracking-tight text-text-primary">{title}</h1>
        {description !== undefined && <p className="mt-0.5 max-w-2xl text-sm text-text-muted">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
