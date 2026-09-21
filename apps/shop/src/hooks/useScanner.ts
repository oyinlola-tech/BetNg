import { useEffect, useRef } from "react";
import { getScannerAdapter, type ScannerAdapter } from "../services/scanner";

export function useScanner(onScan: (code: string) => void, { enabled = true, adapter }: { readonly enabled?: boolean; readonly adapter?: ScannerAdapter } = {}): void {
  const handler = useRef(onScan);

  handler.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    return (adapter ?? getScannerAdapter()).start((code) => {
      handler.current(code);
    });
  }, [enabled, adapter]);
}
