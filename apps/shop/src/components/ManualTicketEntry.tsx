import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ScanLine, Search } from "lucide-react";
import { Button, cn } from "@betng/ui-web";
import { normaliseCode } from "../lib/ticket";

export interface ManualTicketEntryProps {
  readonly label: string;
  readonly actionLabel: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (code: string) => void;
  readonly busy?: boolean;
  readonly scanned?: boolean;
  readonly hint?: string;
}

export interface ManualTicketEntryHandle {
  readonly select: () => void;
}

export const ManualTicketEntry = forwardRef<ManualTicketEntryHandle, ManualTicketEntryProps>(function ManualTicketEntry(
  { label, actionLabel, value, onChange, onSubmit, busy = false, scanned = false, hint = "Type the ID and press Enter." },
  handle,
) {
  const ref = useRef<HTMLInputElement>(null);

  useImperativeHandle(handle, () => ({ select: () => ref.current?.select() }), []);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();

        const code = normaliseCode(value);

        if (code === "") return;

        onChange(code);
        onSubmit(code);
        ref.current?.select();
      }}
    >
      <label htmlFor="ticket-lookup" className="caps-label mb-1.5 block">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex h-16 min-w-0 flex-1 items-center rounded-md border-2 border-border-strong bg-surface px-4 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
          <ScanLine className={cn("size-6 shrink-0", scanned ? "text-success" : "text-text-muted")} aria-hidden />
          <input
            ref={ref}
            id="ticket-lookup"
            value={value}
            onChange={(event) => {
              onChange(event.target.value.toUpperCase());
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
        {hint}
      </p>
    </form>
  );
});
