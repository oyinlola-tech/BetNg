import { useEffect, useState } from "react";

/** A ticking `now` that only runs while something on screen depends on it. */
export function useMatchNow(
  enabled: boolean,
  override?: number,
  intervalMs = 1000,
): number {
  const [now, setNow] = useState(() => Date.now());
  const active = enabled && override === undefined;

  useEffect(() => {
    if (!active) return;

    setNow(Date.now());

    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs]);

  return override ?? now;
}
