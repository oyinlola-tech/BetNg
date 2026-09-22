import { useEffect, useState } from "react";

/* True once no remote key has been pressed for `ms`. Zero or less never goes idle. */
export function useInactivity(ms: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    setIdle(false);
    if (ms <= 0) return;

    let timer = setTimeout(() => {
      setIdle(true);
    }, ms);

    const reset = (): void => {
      clearTimeout(timer);
      setIdle(false);
      timer = setTimeout(() => {
        setIdle(true);
      }, ms);
    };

    document.addEventListener("keydown", reset, true);
    document.addEventListener("pointerdown", reset, true);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", reset, true);
      document.removeEventListener("pointerdown", reset, true);
    };
  }, [ms]);

  return idle;
}
