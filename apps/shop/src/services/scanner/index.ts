export interface ScannerAdapter {
  readonly name: string;
  /** Delivers each complete code read by the device; returns a stop function. */
  start(onScan: (code: string) => void): () => void;
}

export interface KeyboardWedgeOptions {
  readonly target?: Pick<Window, "addEventListener" | "removeEventListener">;
  /** A wedge scanner types far faster than a person; keystrokes further apart than this are treated as typing. */
  readonly maxKeyGapMs?: number;
  readonly minLength?: number;
  readonly now?: () => number;
}

/** A keyboard-wedge reader types the code and presses Enter. Only a fast burst ending in Enter counts as a scan; typing is left alone. */
export function createKeyboardWedgeScanner({ target, maxKeyGapMs = 35, minLength = 6, now = () => performance.now() }: KeyboardWedgeOptions = {}): ScannerAdapter {
  return {
    name: "Keyboard-wedge scanner",
    start: (onScan) => {
      const host = target ?? window;
      let buffer = "";
      let last = Number.NEGATIVE_INFINITY;

      const onKey = (event: Event): void => {
        if (!(event instanceof KeyboardEvent) || event.isComposing) return;
        if (event.ctrlKey || event.altKey || event.metaKey) {
          buffer = "";

          return;
        }

        const at = now();

        if (at - last > maxKeyGapMs) buffer = "";
        last = at;

        if (event.key === "Enter") {
          const code = buffer;

          buffer = "";
          if (code.length >= minLength) {
            event.preventDefault();
            event.stopPropagation();
            onScan(code);
          }

          return;
        }

        if (event.key.length === 1) buffer += event.key;
        else if (event.key !== "Shift") buffer = "";
      };

      host.addEventListener("keydown", onKey, true);

      return () => {
        host.removeEventListener("keydown", onKey, true);
      };
    },
  };
}

let active: ScannerAdapter | undefined;

export function getScannerAdapter(): ScannerAdapter {
  active ??= createKeyboardWedgeScanner();

  return active;
}

/** A camera or serial reader replaces the wedge by implementing the same interface. */
export function setScannerAdapter(adapter: ScannerAdapter): void {
  active = adapter;
}
