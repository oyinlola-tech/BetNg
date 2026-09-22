import { WifiOff } from "lucide-react";
import { cn, useOnline } from "@betng/ui-web";

/** Money commands need the platform to answer; nothing is held back to send later. */
export function OfflineMoneyNotice({ action, className }: { readonly action: string; readonly className?: string }): React.JSX.Element | null {
  const online = useOnline();

  if (online) return null;

  return (
    <p role="status" className={cn("type-small flex items-start gap-2 rounded-sm border border-border bg-surface-sunken px-3 py-2.5 text-text-secondary", className)}>
      <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>You are offline. {action} is never queued or sent later: reconnect and submit it again.</span>
    </p>
  );
}
