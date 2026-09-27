import { Link } from "react-router";
import { CalendarClock, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@betng/ui-core";
import { cn } from "@betng/ui-web";
import { paths } from "../../lib/paths";
import { EffectiveCountdown } from "./EffectiveCountdown";
import { LIMIT_LABEL, nextPendingLimit } from "./limitMeta";
import { useLimitsSummary } from "./limitQueries";

/**
 * Shown while the platform reports the account as restricted, or, more quietly, while a limit change waits out its cooling-off period.
 * Renders nothing otherwise, while loading or when the feature is off.
 */
export function ResponsibleGamingBanner({ className, pendingNotice = true }: { readonly className?: string; readonly pendingNotice?: boolean }): React.JSX.Element | null {
  const summary = useLimitsSummary();

  if (summary.data === undefined) return null;

  if (!summary.data.restricted) {
    const pending = pendingNotice ? nextPendingLimit(summary.data.limits) : undefined;

    if (pending === undefined) return null;

    const others = summary.data.limits.filter((limit) => limit.pendingEffectiveAt !== undefined).length - 1;

    return (
      <div role="status" className={cn("flex items-start gap-2.5 rounded-sm border border-border bg-surface px-3 py-2.5", className)} data-testid="limit-pending-banner">
        <CalendarClock className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden />
        <p className="type-small text-text-secondary">
          Your {LIMIT_LABEL[pending.kind].toLowerCase()} {pending.pendingValue === undefined ? "removal" : "change"} takes effect <EffectiveCountdown at={pending.pendingEffectiveAt} elapsedLabel="now" />
          {others > 0 ? ` (and ${String(others)} more)` : ""}.{" "}
          <Link to={paths.responsibleGaming} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
            Your limits
          </Link>
        </p>
      </div>
    );
  }

  const endsAt = summary.data.selfExclusion.endsAt;

  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-sm border border-warning/40 bg-warning-subtle px-3 py-2.5", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="type-small text-text-primary">
        <span className="font-semibold">Your account is restricted.</span> Betting and deposits are paused
        {endsAt === undefined ? "" : ` until ${formatDateTime(endsAt)}`}.{" "}
        <Link to={paths.responsibleGaming} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
          Responsible gaming
        </Link>
      </p>
    </div>
  );
}
