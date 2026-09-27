import { CheckCircle2, Circle, CircleDot, XCircle, type LucideIcon } from "lucide-react";
import type { PaymentDirection, PaymentRecord, PaymentStatus } from "@betng/contracts";
import { formatDateTime } from "@betng/ui-core";
import { Card, SectionHeading, cn } from "@betng/ui-web";
import { isTerminalPayment } from "./paymentMeta";

export type TimelineState = "done" | "current" | "upcoming" | "stopped";

export interface TimelineStep {
  readonly label: string;
  readonly state: TimelineState;
  /** Only a time the platform reported for this step; never inferred. */
  readonly at?: string | undefined;
}

type Stage = "requested" | "processing" | "finished";

const COPY: Readonly<Record<PaymentDirection, Readonly<Record<Stage, string>>>> = {
  DEPOSIT: { requested: "Payment started", processing: "Confirming with the provider", finished: "Wallet credited" },
  WITHDRAWAL: { requested: "Request received", processing: "Transfer in progress", finished: "Paid to your bank" },
};

const STOPPED: Readonly<Record<PaymentDirection, Partial<Record<PaymentStatus, string>>>> = {
  DEPOSIT: { FAILED: "Payment failed", CANCELLED: "Payment cancelled", EXPIRED: "Payment window closed", REVERSED: "Payment reversed" },
  WITHDRAWAL: { FAILED: "Transfer failed", CANCELLED: "Request cancelled", EXPIRED: "Request expired", REVERSED: "Transfer reversed" },
};

/** Steps built only from the record's status and timestamps; a step the platform gave no time for shows none. */
export function paymentTimeline(payment: PaymentRecord): readonly TimelineStep[] {
  const copy = COPY[payment.direction];
  const requested: TimelineStep = { label: copy.requested, state: "done", at: payment.createdAt };
  const finishedAt = payment.completedAt ?? payment.updatedAt;

  if (payment.status === "CONFIRMED") {
    return [requested, { label: copy.processing, state: "done" }, { label: copy.finished, state: "done", at: finishedAt }];
  }

  if (isTerminalPayment(payment.status)) {
    return [requested, { label: STOPPED[payment.direction][payment.status] ?? payment.status, state: "stopped", at: finishedAt }];
  }

  if (payment.status === "PROCESSING") {
    return [requested, { label: copy.processing, state: "current" }, { label: copy.finished, state: "upcoming" }];
  }

  return [{ ...requested, state: "current" }, { label: copy.processing, state: "upcoming" }, { label: copy.finished, state: "upcoming" }];
}

const STATE_META: Readonly<Record<TimelineState, { readonly icon: LucideIcon; readonly tone: string; readonly spoken: string }>> = {
  done: { icon: CheckCircle2, tone: "text-success", spoken: "done" },
  current: { icon: CircleDot, tone: "text-pending", spoken: "current step" },
  upcoming: { icon: Circle, tone: "text-text-muted", spoken: "not yet" },
  stopped: { icon: XCircle, tone: "text-danger", spoken: "final" },
};

export function PaymentTimeline({ payment }: { readonly payment: PaymentRecord }): React.JSX.Element {
  const steps = paymentTimeline(payment);
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const activeIndex = currentIndex === -1 ? steps.length - 1 : currentIndex;

  return (
    <Card>
      <SectionHeading as="h3">Progress</SectionHeading>
      <ol className="mt-3 space-y-3" aria-label="Payment progress">
        {steps.map((step, index) => {
          const meta = STATE_META[step.state];
          const Icon = meta.icon;

          return (
            <li key={step.label} className="flex items-start gap-2.5" aria-current={index === activeIndex ? "step" : undefined} data-state={step.state}>
              <Icon className={cn("mt-0.5 size-4 shrink-0", meta.tone)} aria-hidden />
              <span className="min-w-0">
                <span className={cn("type-body block", step.state === "upcoming" ? "text-text-muted" : "font-semibold text-text-primary")}>
                  {step.label}
                  <span className="sr-only"> ({meta.spoken})</span>
                </span>
                {step.at !== undefined && (
                  <time dateTime={step.at} className="type-small block text-text-muted">
                    {formatDateTime(step.at)}
                  </time>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
