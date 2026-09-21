import { useEffect } from "react";

const FUNCTION_KEY = /^F\d{1,2}$/;

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

/** Function keys fire from inside a field so the cashier's hands stay on the keyboard; printable keys like "/" never fire while typing. */
export function shouldRunShortcut(event: KeyboardEvent): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.repeat) return false;
  if (FUNCTION_KEY.test(event.key)) return true;

  return !isEditableTarget(event.target);
}

export function useShortcuts(bindings: Readonly<Record<string, () => void>>): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const run = bindings[event.key];

      if (run === undefined || !shouldRunShortcut(event) || document.querySelector("dialog[open]") !== null) return;

      event.preventDefault();
      run();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [bindings]);
}
