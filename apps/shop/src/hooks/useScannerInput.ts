import { useEffect, useRef } from "react";

export interface ScannerOptions {
  readonly onScan: (code: string) => void;
  readonly enabled?: boolean;
  /** A wedge scanner types far faster than a person; keystrokes further apart than this are treated as typing. */
  readonly maxKeyGapMs?: number;
  readonly minLength?: number;
}

/**
 * The integration boundary for a barcode / QR reader. Keyboard-wedge scanners need nothing else: they type the code
 * and press Enter, and this hook tells that burst apart from typing. A camera or serial reader plugs in by calling `onScan`.
 */
export function useScannerInput({ onScan, enabled = true, maxKeyGapMs = 35, minLength = 6 }: ScannerOptions): void {
  const handler = useRef(onScan);

  handler.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let last = 0;

    const onKey = (event: KeyboardEvent): void => {
      const now = performance.now();

      if (now - last > maxKeyGapMs) buffer = "";
      last = now;

      if (event.key === "Enter") {
        if (buffer.length >= minLength) {
          event.preventDefault();
          event.stopPropagation();
          handler.current(buffer);
        }
        buffer = "";

        return;
      }

      if (event.key.length === 1) buffer += event.key;
    };

    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [enabled, maxKeyGapMs, minLength]);
}
