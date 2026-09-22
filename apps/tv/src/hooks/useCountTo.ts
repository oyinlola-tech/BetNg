import { useEffect, useState } from "react";

const STEP_MS = 140;

/* Steps the shown number to the platform's value one at a time; reduced motion jumps straight there. */
export function useCountTo(value: number, reduced: boolean): number {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (reduced || shown === value) {
      if (shown !== value) setShown(value);

      return;
    }

    const timer = setTimeout(() => {
      setShown((s) => (s < value ? s + 1 : s > value ? s - 1 : s));
    }, STEP_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [value, shown, reduced]);

  return reduced ? value : shown;
}
