import { WifiOff } from "lucide-react";
import { useConnection } from "../hooks/useConnection";

export function ConnectionPill(): React.JSX.Element | null {
  const state = useConnection();

  if (state === "CONNECTED" || state === "CONNECTING") return null;

  return (
    <div
      role="status"
      className="fixed right-[2rem] top-[1.2rem] z-50 flex items-center gap-[0.6rem] rounded-full bg-warning px-[1.1rem] py-[0.55rem] text-[0.95rem] font-bold text-white shadow-lg animate-fade-in"
    >
      <WifiOff className="size-[1.1rem]" aria-hidden />
      {state === "OFFLINE" ? "Connection lost" : "Reconnecting…"}
    </div>
  );
}
