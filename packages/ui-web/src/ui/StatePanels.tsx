import { Clock, Loader2, Lock, RefreshCw, WifiOff } from "lucide-react";
import type { ConnectionState } from "@betng/ui-core";
import { cn } from "../lib/cn";
import { Button } from "./Button";
import { EmptyState } from "./States";

export function LoadingState({ label = "Loading", className }: { readonly label?: string; readonly className?: string }): React.JSX.Element {
  return (
    <div role="status" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-text-muted", className)}>
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function OfflineState({ onRetry }: { readonly onRetry?: () => void }): React.JSX.Element {
  return (
    <EmptyState
      icon={<WifiOff className="size-5" />}
      title="You are offline"
      description="What is on screen may be out of date. It refreshes as soon as the connection returns."
      {...(onRetry === undefined ? {} : { action: <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw className="size-3.5" />}>Try now</Button> })}
    />
  );
}

export function PermissionDenied({ permission, action }: { readonly permission?: string; readonly action?: React.ReactNode }): React.JSX.Element {
  return (
    <EmptyState
      icon={<Lock className="size-5" />}
      title="Permission denied"
      description={permission === undefined ? "Your role does not include this area. Ask an administrator if you need access." : `Your role does not include “${permission}”. Ask an administrator if you need access.`}
      {...(action === undefined ? {} : { action })}
    />
  );
}

export function SessionExpiredState({ onSignIn }: { readonly onSignIn: () => void }): React.JSX.Element {
  return <EmptyState icon={<Clock className="size-5" />} title="Your session has ended" description="Sign in again to pick up where you left off. Nothing you were working on has been submitted." action={<Button onClick={onSignIn}>Sign in</Button>} />;
}

/** A thin, non-blocking strip for the live connection. Renders nothing while connected. */
export function ConnectionStrip({ state, className }: { readonly state: ConnectionState; readonly className?: string }): React.JSX.Element | null {
  if (state === "CONNECTED") return null;

  const offline = state === "OFFLINE";

  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium", offline ? "bg-danger-subtle text-danger" : "bg-warning-subtle text-warning", className)}>
      {offline ? <WifiOff className="size-3.5" aria-hidden /> : <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {offline ? "Offline. Showing the last data received." : state === "RECONNECTING" ? "Reconnecting to live updates…" : "Connecting to live updates…"}
    </div>
  );
}
