import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/cn";
import { Skeleton } from "./Skeleton";

export interface KpiCardProps {
  readonly label: string;
  readonly value: string | undefined;
  readonly hint?: string;
  /** Change against the comparison period, as a fraction (0.12 = +12%). */
  readonly delta?: number | undefined;
  /** Whether a rise is good news. Payouts rising is not. */
  readonly positiveIsGood?: boolean;
  readonly icon?: React.ReactNode;
  readonly emphasis?: boolean;
  readonly className?: string;
}

/** A headline number. No chart: the figure is the message. */
export function KpiCard({ label, value, hint, delta, positiveIsGood = true, icon, emphasis = false, className }: KpiCardProps): React.JSX.Element {
  const rising = delta !== undefined && delta > 0;
  const flat = delta === undefined || Math.abs(delta) < 0.0005;
  const good = flat ? undefined : rising === positiveIsGood;

  return (
    <div className={cn("rounded-md border border-border bg-surface px-4 py-3", emphasis && "border-brand/40 bg-brand-subtle", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="caps-label">{label}</p>
        {icon !== undefined && <span className="text-text-muted [&>svg]:size-4">{icon}</span>}
      </div>
      {value === undefined ? <Skeleton className="mt-2 h-7 w-24" /> : <p className="mt-1 font-display text-2xl font-semibold tabular text-text-primary">{value}</p>}
      <div className="mt-1 flex min-h-4 items-center gap-1.5 text-sm">
        {!flat && delta !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular", good === true ? "text-success" : "text-danger")}>
            {rising ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {Math.abs(delta * 100).toFixed(1)}%<span className="sr-only">{rising ? " up" : " down"}</span>
          </span>
        )}
        {hint !== undefined && <span className="truncate text-text-muted">{hint}</span>}
      </div>
    </div>
  );
}
