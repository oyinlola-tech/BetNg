import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNow } from "@betng/ui-web";
import { keys } from "../../lib/queryKeys";
import { formatTimeLeft } from "./limitMeta";

/** Time left until `at`; once it passes, the limits are re-read so the platform's new value shows. */
export function EffectiveCountdown({ at, elapsedLabel = "taking effect now" }: { readonly at: string; readonly elapsedLabel?: string }): React.JSX.Element | null {
  const now = useNow();
  const client = useQueryClient();
  const target = Date.parse(at);
  const elapsed = target <= now;
  const wasElapsed = useRef(elapsed);

  useEffect(() => {
    if (elapsed && !wasElapsed.current) void client.invalidateQueries({ queryKey: keys.limitsRoot });
    wasElapsed.current = elapsed;
  }, [elapsed, client]);

  if (Number.isNaN(target)) return null;

  return <span className="tabular">{elapsed ? elapsedLabel : `in ${formatTimeLeft(target - now)}`}</span>;
}
