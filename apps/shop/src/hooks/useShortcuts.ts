import { useEffect } from "react";

/** Function-key shortcuts for the counter. They fire even from inside an input, because a cashier's hands stay on the keyboard. */
export function useShortcuts(bindings: Readonly<Record<string, () => void>>): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const run = bindings[event.key];

      if (run === undefined || document.querySelector("dialog[open]") !== null) return;

      event.preventDefault();
      run();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [bindings]);
}
