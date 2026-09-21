import { cn } from "../lib/cn";

export interface StatBarProps {
  readonly label: string;
  readonly home: number;
  readonly away: number;
  readonly percent?: boolean;
  readonly format?: ((value: number) => string) | undefined;
  readonly className?: string | undefined;
}

export function StatBar({
  label,
  home,
  away,
  percent = false,
  format,
  className,
}: StatBarProps): React.JSX.Element {
  const total = home + away;
  const homeShare = total === 0 ? 50 : (home / total) * 100;
  const homeLeads = home > away;
  const awayLeads = away > home;
  const show =
    format ?? ((value: number) => `${String(value)}${percent ? "%" : ""}`);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "type-data",
            homeLeads ? "font-bold text-text-primary" : "text-text-secondary",
          )}
        >
          {show(home)}
        </span>
        <span className="type-caption text-center">{label}</span>
        <span
          className={cn(
            "type-data",
            awayLeads ? "font-bold text-text-primary" : "text-text-secondary",
          )}
        >
          {show(away)}
        </span>
      </div>
      <div className="mt-1.5 flex h-1.5 gap-0.5" aria-hidden>
        <div className="flex-1 overflow-hidden rounded-l-full bg-surface-sunken">
          <div
            className={cn(
              "ml-auto h-full rounded-l-full transition-[width] duration-[var(--bn-duration-slow)]",
              homeLeads ? "bg-brand" : "bg-border-strong",
            )}
            style={{ width: `${String(homeShare)}%` }}
          />
        </div>
        <div className="flex-1 overflow-hidden rounded-r-full bg-surface-sunken">
          <div
            className={cn(
              "h-full rounded-r-full transition-[width] duration-[var(--bn-duration-slow)]",
              awayLeads ? "bg-brand" : "bg-border-strong",
            )}
            style={{ width: `${String(100 - homeShare)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
