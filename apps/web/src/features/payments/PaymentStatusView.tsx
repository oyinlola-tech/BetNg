import { useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { PaymentDirection, PaymentRecord } from "@betng/contracts";
import { Button, Card, FormError, Skeleton, SkeletonRoot } from "@betng/ui-web";
import { analytics } from "../../services/analytics";
import { ServiceError } from "../wallet/ServiceStates";
import { LinkButton } from "../wallet/LinkButton";
import { forgetInFlight, isTerminalPayment, maskedAccount } from "./paymentMeta";
import { useBankAccounts, usePaymentStatus } from "./paymentQueries";
import { PaymentStatusCard } from "./PaymentStatusCard";

function headline(payment: PaymentRecord): { readonly title: string; readonly body: string } {
  const deposit = payment.direction === "DEPOSIT";

  switch (payment.status) {
    case "CONFIRMED":
      return deposit
        ? { title: "Deposit confirmed", body: "The platform confirmed this payment and credited your wallet." }
        : { title: "Withdrawal completed", body: "The platform confirmed the transfer to your bank account." };
    case "FAILED":
      return deposit
        ? { title: "Deposit not completed", body: "The payment failed. Your wallet was not credited for it." }
        : { title: "Withdrawal failed", body: "The transfer did not go through. The platform returns held funds to your wallet." };
    case "CANCELLED":
      return { title: deposit ? "Deposit cancelled" : "Withdrawal cancelled", body: "This payment was cancelled." };
    case "EXPIRED":
      return { title: deposit ? "Deposit expired" : "Withdrawal expired", body: "The payment window closed before it was completed." };
    case "REVERSED":
      return { title: deposit ? "Deposit reversed" : "Withdrawal reversed", body: "The platform reversed this payment." };
    default:
      return deposit
        ? { title: "Deposit in progress", body: "Waiting for the platform to confirm this payment. Your wallet is credited only once it is confirmed." }
        : { title: "Withdrawal processing", body: "The platform is sending this transfer. It is complete only once it is confirmed." };
  }
}

export function PaymentStatusSkeleton(): React.JSX.Element {
  return (
    <SkeletonRoot label="Loading payment status" className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Card padding="none">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-40" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-3 border-t border-border p-5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex justify-between gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </Card>
    </SkeletonRoot>
  );
}

export interface PaymentStatusViewProps {
  readonly reference: string;
  readonly direction: PaymentDirection;
  readonly pollDelaysMs?: readonly number[];
}

const reported = new Set<string>();

/** Polls the platform until the payment reaches a terminal status; a provider redirect proves nothing on its own. */
export function PaymentStatusView({ reference, direction, pollDelaysMs }: PaymentStatusViewProps): React.JSX.Element {
  const status = usePaymentStatus(reference, direction, pollDelaysMs === undefined ? {} : { pollDelaysMs });
  const accounts = useBankAccounts();
  const payment = status.data;
  const terminal = payment !== undefined && isTerminalPayment(payment.status);

  useEffect(() => {
    if (terminal) forgetInFlight(reference);
  }, [terminal, reference]);

  const confirmed = payment?.status === "CONFIRMED";

  useEffect(() => {
    if (!confirmed || reported.has(reference)) return;

    reported.add(reference);
    analytics.track(direction === "DEPOSIT" ? "deposit_confirmed" : "withdrawal_confirmed");
  }, [confirmed, reference, direction]);

  if (payment === undefined) {
    if (status.isError) {
      return (
        <Card padding="none">
          <ServiceError error={status.error} onRetry={() => void status.refetch()} back={{ to: "/payments", label: "Payment history" }} />
        </Card>
      );
    }

    return <PaymentStatusSkeleton />;
  }

  const copy = headline(payment);
  const account = payment.bankAccountId === undefined ? undefined : accounts.data?.find((item) => item.id === payment.bankAccountId);
  const retryable = terminal && payment.status !== "CONFIRMED" && payment.status !== "REVERSED";

  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite">
        <h2 className="type-h3 flex items-center gap-2 text-text-primary">
          {!terminal && <Loader2 className="size-4 animate-spin text-text-muted" aria-hidden />}
          {copy.title}
        </h2>
        <p className="type-small mt-1 text-text-secondary">{copy.body}</p>
      </div>
      {status.isError && <FormError error={status.error} onRetry={() => void status.refetch()} />}
      <PaymentStatusCard
        payment={payment}
        bankAccountLabel={account === undefined ? undefined : `${account.bankName} ${maskedAccount(account.accountNumberMasked)}`}
        footer={
          <>
            {!terminal && (
              <Button
                variant="secondary"
                size="sm"
                loading={status.isFetching}
                leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
                onClick={() => {
                  void status.refetch();
                }}
              >
                Check status
              </Button>
            )}
            {retryable && (
              <LinkButton to={direction === "DEPOSIT" ? "/wallet/deposit" : "/wallet/withdraw"} variant="primary" size="sm">
                {direction === "DEPOSIT" ? "Start a new deposit" : "Start a new withdrawal"}
              </LinkButton>
            )}
            <LinkButton to="/wallet" variant="ghost" size="sm">
              Back to wallet
            </LinkButton>
          </>
        }
      />
    </div>
  );
}
