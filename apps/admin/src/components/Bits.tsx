import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Copy, Minus } from "lucide-react";
import { formatDateTime, formatKickoffTime, formatMoney, formatShortDate, formatSignedMoney } from "@betng/ui-core";
import { StatusBadge, cn, useLogger } from "@betng/ui-web";
import { DASH, STATUS_LABELS } from "../lib/format";

export function Status({ value, pulse }: { readonly value: string; readonly pulse?: boolean }): React.JSX.Element {
  const label = STATUS_LABELS[value];

  return (
    <StatusBadge status={value} pulse={pulse ?? (value === "IN_PLAY" || value === "RUNNING")}>
      {label}
    </StatusBadge>
  );
}

export function Mono({ children, className }: { readonly children: React.ReactNode; readonly className?: string }): React.JSX.Element {
  return <span className={cn("mono-id whitespace-nowrap text-text-secondary", className)}>{children}</span>;
}

/** A value the contract does not carry. It is shown as absent, never filled in. */
export function Unavailable({ what }: { readonly what?: string }): React.JSX.Element {
  return (
    <span className="text-text-muted" title={`${what ?? "This value"} is not provided by the platform`}>
      <span aria-hidden>{DASH}</span>
      <span className="sr-only">Not provided by the platform</span>
    </span>
  );
}

/** A figure that may be negative. The sign and the arrow carry the direction; colour is not used for it. */
export function SignedMoney({ value, className, whole = false }: { readonly value: number; readonly className?: string; readonly whole?: boolean }): React.JSX.Element {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;

  return (
    <span className={cn("inline-flex items-center justify-end gap-1 whitespace-nowrap tabular", className)}>
      <Icon className="size-3.5 shrink-0 text-text-muted" aria-hidden />
      {whole ? formatMoney(value, { sign: "always", fraction: "never" }) : formatSignedMoney(value)}
    </span>
  );
}

/** A platform timestamp in a table cell: the time, with the day beneath it. Absent stays absent. */
export function Stamp({ iso }: { readonly iso: string | undefined }): React.JSX.Element {
  if (iso === undefined) return <span className="text-text-muted">{DASH}</span>;

  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="block whitespace-nowrap leading-tight tabular">
      <span className="block text-text-primary">{formatKickoffTime(iso)}</span>
      <span className="block text-sm text-text-muted">{formatShortDate(iso)}</span>
    </time>
  );
}

export function CopyButton({ value, label, sensitive = false }: { readonly value: string; readonly label: string; readonly sensitive?: boolean }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const logger = useLogger();

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={label}
      onClick={() => {
        navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
            }, 1500);
          },
          () => {
            logger.warn("ui", sensitive ? "A one-time credential could not be copied" : "Copy to clipboard failed");
          },
        );
      }}
      className="inline-flex size-6 items-center justify-center rounded-xs text-text-muted hover:bg-surface-hover hover:text-text-primary focus-ring"
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

export function DetailItem({ label, children, className }: { readonly label: string; readonly children: React.ReactNode; readonly className?: string }): React.JSX.Element {
  return (
    <div className={className}>
      <dt className="caps-label">{label}</dt>
      <dd className="mt-0.5 text-base text-text-primary">{children}</dd>
    </div>
  );
}

/** One platform figure against another. The bar only draws the two numbers beside it; it reaches no verdict. */
export function Meter({ value, limit, label }: { readonly value: number; readonly limit: number; readonly label: string }): React.JSX.Element {
  const ratio = limit <= 0 ? 0 : Math.max(0, Math.min(1, value / limit));

  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
      <div className="h-full rounded-full bg-series-1 transition-[width] duration-[var(--bn-duration-slow)]" style={{ width: `${String(ratio * 100)}%` }} />
    </div>
  );
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
