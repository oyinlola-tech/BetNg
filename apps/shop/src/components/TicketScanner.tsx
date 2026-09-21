import { useRef, useState } from "react";
import { useScanner } from "../hooks/useScanner";
import { normaliseCode } from "../lib/ticket";
import type { ScannerAdapter } from "../services/scanner";
import { ManualTicketEntry, type ManualTicketEntryHandle } from "./ManualTicketEntry";

export interface TicketScannerProps {
  readonly label: string;
  readonly actionLabel: string;
  readonly initial?: string;
  readonly busy?: boolean;
  readonly onSubmit: (code: string) => void;
  readonly adapter?: ScannerAdapter;
}

/** Manual entry plus whichever reader is configured; both end in the same lookup against the platform. */
export function TicketScanner({ label, actionLabel, initial = "", busy = false, onSubmit, adapter }: TicketScannerProps): React.JSX.Element {
  const [value, setValue] = useState(initial);
  const [scanned, setScanned] = useState(false);
  const entry = useRef<ManualTicketEntryHandle>(null);

  useScanner(
    (raw) => {
      const code = normaliseCode(raw);

      if (code === "") return;

      setValue(code);
      setScanned(true);
      onSubmit(code);
      entry.current?.select();
    },
    adapter === undefined ? {} : { adapter },
  );

  return (
    <ManualTicketEntry
      ref={entry}
      label={label}
      actionLabel={actionLabel}
      value={value}
      busy={busy}
      scanned={scanned}
      hint="Type the ID and press Enter, or scan the barcode on the ticket. A keyboard-wedge scanner works from anywhere on this screen."
      onChange={(next) => {
        setValue(next);
        setScanned(false);
      }}
      onSubmit={onSubmit}
    />
  );
}
