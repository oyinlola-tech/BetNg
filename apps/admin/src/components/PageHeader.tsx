export interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps): React.JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="type-h2 text-text-primary">{title}</h1>
        {description !== undefined && <p className="mt-0.5 max-w-3xl text-sm text-text-muted">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
