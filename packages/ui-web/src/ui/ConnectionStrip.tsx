import { Clock, Loader2, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatAge } from "@betng/ui-core";
import type { ConnectionState } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { useNow } from "../hooks/useNow";

export type Timestamp = string | number | Date;

export interface ConnectionStripProps {
  readonly state: ConnectionState;
  readonly lastUpdatedAt?: Timestamp | undefined;
  /** While connected, data older than this is called out as stale. */
  readonly staleAfterMs?: number;
  readonly onRetry?: () => void;
  readonly className?: string;
}

type Shown = Exclude<ConnectionState, "CONNECTED"> | "STALE";

interface StripPreset {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly classes: string;
  readonly spin?: boolean;
}

const PRESETS: Record<Shown, StripPreset> = {
  CONNECTING: {
    icon: Loader2,
    label: "Connecting to live updates",
    classes: "bg-info-subtle text-info",
    spin: true,
  },
  RECONNECTING: {
    icon: Loader2,
    label: "Reconnecting",
    classes: "bg-warning-subtle text-warning",
    spin: true,
  },
  OFFLINE: {
    icon: WifiOff,
    label: "Connection lost. Showing the last data received.",
    classes: "bg-danger-subtle text-danger",
  },
  FAILED: {
    icon: TriangleAlert,
    label: "Live updates are unavailable.",
    classes: "bg-danger-subtle text-danger",
  },
  STALE: {
    icon: Clock,
    label: "Live updates have paused.",
    classes: "bg-surface-sunken text-text-secondary",
  },
};

export function toIso(value: Timestamp): string | undefined {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/** A thin, non-blocking strip for the live connection. Renders nothing while connected and fresh. */
export function ConnectionStrip({
  state,
  lastUpdatedAt,
  staleAfterMs = 60_000,
  onRetry,
  className,
}: ConnectionStripProps): React.JSX.Element | null {
  const now = useNow(lastUpdatedAt === undefined ? 60_000 : 1000);
  const iso = lastUpdatedAt === undefined ? undefined : toIso(lastUpdatedAt);
  const stale = iso !== undefined && now - Date.parse(iso) > staleAfterMs;

  if (state === "CONNECTED" && !stale) return null;

  const preset = PRESETS[state === "CONNECTED" ? "STALE" : state];
  const Icon = preset.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-state={state}
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-1.5 text-sm font-medium",
        preset.classes,
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-3.5 shrink-0", preset.spin === true && "animate-spin")}
      />
      <span>{preset.label}</span>
      {iso !== undefined && (
        <span className="tabular opacity-80">
          Last updated {formatAge(iso, now)}
        </span>
      )}
      {onRetry !== undefined && (state === "FAILED" || state === "OFFLINE") && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-xs font-semibold underline underline-offset-2 focus-ring"
        >
          <RefreshCw aria-hidden className="size-3" />
          Retry
        </button>
      )}
    </div>
  );
}
