import { Link } from "react-router";
import { ShieldAlert } from "lucide-react";
import { formatDateTime } from "@betng/ui-core";
import { cn } from "@betng/ui-web";
import { useLimitsSummary } from "./limitQueries";

/** Shown while the platform reports the account as restricted; renders nothing otherwise, while loading or when the feature is off. */
export function ResponsibleGamingBanner({ className }: { readonly className?: string }): React.JSX.Element | null {
  const summary = useLimitsSummary();

  if (summary.data?.restricted !== true) return null;

  const endsAt = summary.data.selfExclusion.endsAt;

  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-sm border border-warning/40 bg-warning-subtle px-3 py-2.5", className)}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="type-small text-text-primary">
        <span className="font-semibold">Your account is restricted.</span> Betting and deposits are paused
        {endsAt === undefined ? "" : ` until ${formatDateTime(endsAt)}`}.{" "}
        <Link to="/responsible-gaming" className="rounded-xs font-semibold text-brand hover:underline focus-ring">
          Responsible gaming
        </Link>
      </p>
    </div>
  );
}
