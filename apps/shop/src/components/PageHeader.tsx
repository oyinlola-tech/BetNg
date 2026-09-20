export function PageHeader({ title, description, actions }: { readonly title: string; readonly description?: string; readonly actions?: React.ReactNode }): React.JSX.Element {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight text-text-primary">{title}</h1>
        {description !== undefined && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
