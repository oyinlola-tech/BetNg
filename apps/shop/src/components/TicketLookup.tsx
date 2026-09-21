import { useEffect, useRef, useState } from "react";
import { ScanLine, Search } from "lucide-react";
import { Button, cn } from "@betng/ui-web";
import { useScannerInput } from "../hooks/useScannerInput";
import { normaliseCode } from "../lib/ticket";

export interface TicketLookupProps {
  readonly label: string;
  readonly actionLabel: string;
  readonly initial?: string;
  readonly busy?: boolean;
  readonly onSubmit: (code: string) => void;
}

export function TicketLookup({ label, actionLabel, initial = "", busy = false, onSubmit }: TicketLookupProps): React.JSX.Element {
  const [value, setValue] = useState(initial);
  const [scanned, setScanned] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  useScannerInput({
    onScan: (raw) => {
      const code = normaliseCode(raw);

      setValue(code);
      setScanned(true);
      onSubmit(code);
    },
  });

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();

        const code = normaliseCode(value);

        if (code === "") return;

        setValue(code);
        setScanned(false);
        onSubmit(code);
        ref.current?.select();
      }}
    >
      <label htmlFor="ticket-lookup" className="caps-label mb-1.5 block">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex h-16 min-w-0 flex-1 items-center rounded-md border-2 border-border-strong bg-surface px-4 transition-colors focus-within:border-brand">
          <ScanLine className={cn("size-6 shrink-0", scanned ? "text-success" : "text-text-muted")} aria-hidden />
          <input
            ref={ref}
            id="ticket-lookup"
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toUpperCase());
              setScanned(false);
            }}
            placeholder="BNG-XXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={16}
            aria-describedby="ticket-lookup-hint"
            className="h-full w-full min-w-0 bg-transparent px-3 font-mono text-3xl font-semibold tracking-widest text-text-primary outline-none placeholder:font-normal placeholder:tracking-wider placeholder:text-text-muted/60"
          />
        </div>
        <Button type="submit" size="lg" loading={busy} className="h-16 px-6" icon={<Search className="size-4" />}>
          {actionLabel}
        </Button>
      </div>
      <p id="ticket-lookup-hint" className="mt-1.5 text-sm text-text-muted">
        Type the ID and press Enter, or scan the barcode on the ticket. A keyboard-wedge scanner works from anywhere on this screen.
      </p>
    </form>
  );
}
