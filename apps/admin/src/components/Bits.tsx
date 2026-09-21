import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { StatusBadge, cn } from "@betng/ui-web";
import { statusView } from "../lib/format";

export function Status({ value, pulse, quiet = false }: { readonly value: string; readonly pulse?: boolean; readonly quiet?: boolean }): React.JSX.Element {
  const base = statusView(value);
  const view = quiet && value === "COMPLETED" ? { ...base, tone: "neutral" as const } : base;

  return (
    <StatusBadge tone={view.tone} pulse={pulse ?? (value === "IN_PLAY" || value === "RUNNING")}>
      {view.label}
    </StatusBadge>
  );
}

export function Mono({ children, className }: { readonly children: React.ReactNode; readonly className?: string }): React.JSX.Element {
  return <span className={cn("mono-id whitespace-nowrap text-text-secondary", className)}>{children}</span>;
}

export function CopyButton({ value, label }: { readonly value: string; readonly label: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 1500);
        });
      }}
      className="inline-flex size-6 items-center justify-center rounded-xs text-text-muted hover:bg-surface-hover hover:text-text-primary focus-ring"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function Field({ label, children, className }: { readonly label: string; readonly children: React.ReactNode; readonly className?: string }): React.JSX.Element {
  return (
    <div className={className}>
      <dt className="caps-label">{label}</dt>
      <dd className="mt-0.5 text-base text-text-primary">{children}</dd>
    </div>
  );
}

/** Exposure against its limit. The bar turns with the state; the figures beside it carry the meaning. */
export function Meter({ value, limit, label }: { readonly value: number; readonly limit: number; readonly label: string }): React.JSX.Element {
  const ratio = limit <= 0 ? 0 : Math.min(1, value / limit);
  const tone = ratio > 0.85 ? "bg-danger" : ratio > 0.55 ? "bg-warning" : "bg-success";

  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} className="relative h-2 overflow-hidden rounded-full bg-surface-sunken">
      <div className={cn("h-full rounded-full transition-[width] duration-[var(--bn-duration-slow)]", tone)} style={{ width: `${String(Math.max(1, ratio * 100))}%` }} />
      <span className="absolute inset-y-0 w-px bg-border-strong" style={{ left: "55%" }} aria-hidden />
      <span className="absolute inset-y-0 w-px bg-border-strong" style={{ left: "85%" }} aria-hidden />
    </div>
  );
}

export function FilterBar({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">{children}</div>;
}

/** Changes whenever `value` changes after mount, for replaying the flash animation on just that element. */
export function useFlashKey(value: string | number): number {
  const previous = useRef(value);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setKey((n) => n + 1);
    }
  }, [value]);

  return key;
}
