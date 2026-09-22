import { History, WifiOff } from "lucide-react";
import { formatAge } from "@betng/ui-core";
import { useNow } from "@betng/ui-web";
import { usePwa } from "../../pwa/pwa";

/** Offline, or showing the saved copy of public data. Money commands are never queued, and the banner says so. */
export function OfflineBanner({ online }: { readonly online: boolean }): React.JSX.Element | null {
  const { staleSince } = usePwa();
  const now = useNow(30_000);

  if (online && staleSince === undefined) return null;

  const saved = staleSince === undefined ? undefined : formatAge(new Date(staleSince).toISOString(), now);

  return (
    <div role="status" aria-live="polite" data-state={online ? "STALE" : "OFFLINE"} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-warning-subtle px-4 py-1.5 text-sm font-medium text-warning">
      {online ? <History aria-hidden className="size-3.5 shrink-0" /> : <WifiOff aria-hidden className="size-3.5 shrink-0" />}
      <span>{online ? "The platform is not answering. Showing saved data." : "You are offline. Showing the last data received."}</span>
      {saved !== undefined && <span className="tabular opacity-80">Saved {saved}</span>}
      <span className="text-text-secondary">Bets, deposits and withdrawals are never queued: they need a connection.</span>
    </div>
  );
}
