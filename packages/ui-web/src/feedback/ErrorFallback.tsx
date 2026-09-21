import { Home, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn";
import { presentError } from "../lib/errors";
import { Button } from "../ui/Button";

export type ErrorScope = "global" | "route" | "feature";

export interface ErrorFallbackProps {
  readonly error: unknown;
  readonly scope?: ErrorScope;
  readonly onReset?: () => void;
  readonly homeHref?: string;
  readonly className?: string;
}

const TITLES: Record<ErrorScope, string> = {
  global: "BETNG hit a problem",
  route: "This page could not be shown",
  feature: "This section is unavailable",
};

const DESCRIPTIONS: Record<ErrorScope, string> = {
  global: "Something unexpected stopped the app. Reload to continue. Your balance and bets are safe on the platform.",
  route: "Something went wrong while showing this page. Try again, or head back home.",
  feature: "The rest of the page still works.",
};

function homeLink(href: string): React.JSX.Element {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-base font-semibold text-text-primary hover:bg-surface-hover focus-ring"
    >
      <Home aria-hidden className="size-4" />
      Go home
    </a>
  );
}

export function ErrorFallback({
  error,
  scope = "route",
  onReset,
  homeHref = "/",
  className,
}: ErrorFallbackProps): React.JSX.Element {
  const { requestId } = presentError(error);

  const reference = requestId !== undefined && (
    <p className="font-mono text-xs text-text-muted">
      Support reference <span className="select-all text-text-secondary">{requestId}</span>
    </p>
  );

  if (scope === "feature")
    return (
      <div
        role="alert"
        className={cn(
          "flex items-start gap-3 rounded-md border border-border bg-surface p-3",
          className,
        )}
      >
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-text-primary">{TITLES.feature}</p>
          <p className="text-sm text-text-muted">{DESCRIPTIONS.feature}</p>
          {reference}
        </div>
        {onReset !== undefined && (
          <Button variant="secondary" size="xs" onClick={onReset}>
            Retry
          </Button>
        )}
      </div>
    );

  const global = scope === "global";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        global ? "min-h-dvh bg-background py-16" : "rounded-md border border-border bg-surface py-16",
        className,
      )}
    >
      <div
        aria-hidden
        className="flex size-12 items-center justify-center rounded-md bg-danger-subtle text-danger"
      >
        <TriangleAlert className="size-6" />
      </div>
      <h1 className={cn("mt-4 text-text-primary", global ? "type-h2" : "type-h3")}>
        {TITLES[scope]}
      </h1>
      <p className="mt-2 max-w-sm text-base text-text-secondary">{DESCRIPTIONS[scope]}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {global ? (
          <Button
            leadingIcon={<RotateCw aria-hidden className="size-4" />}
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload
          </Button>
        ) : (
          <>
            {onReset !== undefined && (
              <Button leadingIcon={<RefreshCw aria-hidden className="size-4" />} onClick={onReset}>
                Try again
              </Button>
            )}
            {homeLink(homeHref)}
          </>
        )}
      </div>
      {reference !== false && <div className="mt-6">{reference}</div>}
    </div>
  );
}
