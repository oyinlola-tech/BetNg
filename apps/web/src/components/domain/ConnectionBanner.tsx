import { WifiOff } from "lucide-react";
import { useConnection } from "../../hooks/useConnection";
import { cn } from "@betng/ui-web";

export function ConnectionBanner({
  className,
}: {
  readonly className?: string;
}): React.JSX.Element | null {
  const state = useConnection();

  if (state === "CONNECTED" || state === "CONNECTING") return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 bg-warning-subtle px-4 py-1.5 text-sm font-medium text-warning",
        className,
      )}
    >
      <WifiOff className="size-3.5" aria-hidden />
      {state === "OFFLINE"
        ? "You're offline. Live updates will resume when the connection returns."
        : "Connection lost — reconnecting…"}
    </div>
  );
}
