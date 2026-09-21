import { Ban, CheckCircle2, CircleDashed, Clock, Loader, RotateCcw, TimerOff, XCircle, type LucideIcon } from "lucide-react";
import type { PaymentStatus } from "@betng/contracts";
import { StatusBadge, type StatusTone } from "@betng/ui-web";

const STATUS: Readonly<Record<PaymentStatus, { readonly label: string; readonly tone: StatusTone; readonly icon: LucideIcon }>> = {
  INITIATED: { label: "Started", tone: "pending", icon: CircleDashed },
  PENDING: { label: "Awaiting payment", tone: "pending", icon: Clock },
  PROCESSING: { label: "Processing", tone: "pending", icon: Loader },
  CONFIRMED: { label: "Confirmed", tone: "success", icon: CheckCircle2 },
  FAILED: { label: "Failed", tone: "danger", icon: XCircle },
  CANCELLED: { label: "Cancelled", tone: "neutral", icon: Ban },
  EXPIRED: { label: "Expired", tone: "neutral", icon: TimerOff },
  REVERSED: { label: "Reversed", tone: "info", icon: RotateCcw },
};

export function paymentStatusLabel(status: PaymentStatus): string {
  return STATUS[status].label;
}

/** A word and an icon for every payment status, never colour alone. */
export function PaymentStatusBadge({ status, className }: { readonly status: PaymentStatus; readonly className?: string }): React.JSX.Element {
  const meta = STATUS[status];

  return (
    <StatusBadge tone={meta.tone} icon={meta.icon} {...(className === undefined ? {} : { className })}>
      {meta.label}
    </StatusBadge>
  );
}
