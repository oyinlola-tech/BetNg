import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { DataSourceError } from "@betng/ui-core";
import {
  ForbiddenState,
  MaintenanceState,
  NotFoundState,
  UnauthorizedState,
} from "../ui/StatePanels";
import { ErrorFallback } from "./ErrorFallback";

export interface RouteErrorBoundaryProps {
  readonly onError?: (error: unknown) => void;
  readonly onSignIn?: () => void;
  readonly homeHref?: string;
  readonly className?: string;
}

type RouteErrorKind = "notFound" | "unauthorized" | "forbidden" | "maintenance" | "error";

function classify(error: unknown): RouteErrorKind {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return "notFound";
    if (error.status === 401) return "unauthorized";
    if (error.status === 403) return "forbidden";
    if (error.status === 503) return "maintenance";
  }

  if (error instanceof DataSourceError) {
    if (error.code === "NOT_FOUND") return "notFound";
    if (error.code === "UNAUTHENTICATED" || error.code === "SESSION_EXPIRED")
      return "unauthorized";
    if (error.code === "FORBIDDEN") return "forbidden";
    if (error.code === "UNAVAILABLE") return "maintenance";
  }

  return "error";
}

/** For a route's `errorElement`. Must render inside a data router. */
export function RouteErrorBoundary({
  onError,
  onSignIn,
  homeHref = "/",
  className,
}: RouteErrorBoundaryProps): React.JSX.Element {
  const error = useRouteError();
  const kind = classify(error);

  useEffect(() => {
    onError?.(error);
  }, [error, onError]);

  const home = (
    <a
      href={homeHref}
      className="inline-flex h-10 items-center rounded-sm border border-border-strong bg-surface px-4 text-base font-semibold text-text-primary hover:bg-surface-hover focus-ring"
    >
      Go home
    </a>
  );

  if (kind === "error")
    return (
      <ErrorFallback
        error={error}
        scope="route"
        homeHref={homeHref}
        onReset={() => {
          window.location.reload();
        }}
        {...(className === undefined ? {} : { className })}
      />
    );

  return (
    <div className={className}>
      {kind === "notFound" && <NotFoundState action={home} />}
      {kind === "unauthorized" && (
        <UnauthorizedState {...(onSignIn === undefined ? { action: home } : { onSignIn })} />
      )}
      {kind === "forbidden" && <ForbiddenState action={home} />}
      {kind === "maintenance" && (
        <MaintenanceState
          onRetry={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
