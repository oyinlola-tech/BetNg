import { WifiOff } from "lucide-react";
import { useConnection } from "../hooks/useConnection";
import { useDataHealth } from "../lib/dataHealth";

function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Says when what is on screen may be old: the socket is down, or reads are failing. Never covers the picture. */
export function ConnectionPill(): React.JSX.Element | null {
  const connection = useConnection();
  const health = useDataHealth();
  const socketDown = connection === "OFFLINE" || connection === "RECONNECTING" || connection === "FAILED";

  if (!socketDown && !health.failing) return null;

  const headline = connection === "OFFLINE" || connection === "FAILED" ? "Connection lost" : socketDown ? "Reconnecting" : "Updates delayed";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-[2rem] top-[1.2rem] z-50 flex items-center gap-[0.6rem] rounded-full bg-warning px-[1.1rem] py-[0.55rem] text-[0.95rem] font-bold text-text-on-status shadow-lg animate-fade-in"
    >
      <WifiOff className="size-[1.1rem]" aria-hidden />
      {headline}
      {health.lastSuccessAt !== undefined && <span className="font-medium tabular opacity-90">· last updated {clockTime(health.lastSuccessAt)}</span>}
    </div>
  );
}
