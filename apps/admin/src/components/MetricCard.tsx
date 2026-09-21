import { CircleSlash, Lock, TriangleAlert } from "lucide-react";
import { DataSourceError } from "@betng/ui-core";
import { Skeleton, cn, presentError } from "@betng/ui-web";

export type MetricState =
  | { readonly kind: "ready"; readonly value: React.ReactNode }
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable"; readonly reason?: string }
  | { readonly kind: "forbidden"; readonly permission: string }
  | { readonly kind: "error"; readonly error: unknown };

export interface MetricCardProps {
  readonly label: string;
  readonly state: MetricState;
  /** Where the figure comes from and how the platform defines it. */
  readonly hint?: string | undefined;
  readonly icon?: React.ReactNode;
  readonly className?: string;
}

/** Resolves a query into a card state. A figure is only ever what the platform answered. */
export function metricFrom<T>(query: { readonly data: T | undefined; readonly error: unknown }, pick: (data: T) => React.ReactNode | undefined, permission?: { readonly name: string; readonly granted: boolean }): MetricState {
  if (permission !== undefined && !permission.granted) return { kind: "forbidden", permission: permission.name };

  if (query.data !== undefined) {
    const value = pick(query.data);

    return value === undefined ? { kind: "unavailable" } : { kind: "ready", value };
  }

  if (query.error !== null && query.error !== undefined) {
    if (query.error instanceof DataSourceError && query.error.code === "FORBIDDEN") return { kind: "forbidden", permission: permission?.name ?? "this figure" };
    if (query.error instanceof DataSourceError && query.error.code === "NOT_IMPLEMENTED") return { kind: "unavailable" };

    return { kind: "error", error: query.error };
  }

  return { kind: "loading" };
}

function Note({ icon, children }: { readonly icon: React.ReactNode; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-text-muted [&>svg]:mt-0.5 [&>svg]:size-3.5 [&>svg]:shrink-0">
      {icon}
      <span>{children}</span>
    </p>
  );
}

export function MetricCard({ label, state, hint, icon, className }: MetricCardProps): React.JSX.Element {
  return (
    <div data-state={state.kind} className={cn("flex min-h-[92px] flex-col rounded-md border border-border bg-surface px-4 py-3", state.kind === "unavailable" && "border-dashed", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="caps-label">{label}</h3>
        {icon !== undefined && <span className="text-text-muted [&>svg]:size-4">{icon}</span>}
      </div>
      {state.kind === "ready" && <p className="mt-1 font-display text-xl font-semibold tabular text-text-primary xl:text-2xl">{state.value}</p>}
      {state.kind === "loading" && <Skeleton className="mt-2 h-7 w-24" />}
      {state.kind === "unavailable" && <Note icon={<CircleSlash aria-hidden />}>{state.reason ?? "Unavailable from the platform"}</Note>}
      {state.kind === "forbidden" && <Note icon={<Lock aria-hidden />}>Your role does not include “{state.permission}”</Note>}
      {state.kind === "error" && <Note icon={<TriangleAlert aria-hidden />}>{presentError(state.error).title}</Note>}
      {hint !== undefined && state.kind === "ready" && <p className="mt-auto pt-1 text-sm text-text-muted">{hint}</p>}
    </div>
  );
}
