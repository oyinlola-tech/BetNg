import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Landmark } from "lucide-react";
import type { BankAccount, WithdrawalQuote, WithdrawalRequest } from "@betng/contracts";
import { DataSourceError, createIdempotencyKey, currentCurrency, formatDateTime, formatMoney, parseMoney } from "@betng/ui-core";
import { Button, Card, ConfirmDialog, EmptyState, Field, FormError, Input, SkeletonRoot, Skeleton, applyFieldErrors, useToast } from "@betng/ui-web";
import { useWallet } from "../../hooks/accountQueries";
import { accountServices, logger } from "../../services/runtime";
import { amountField, amountInputValue } from "../wallet/amount";
import { LinkButton } from "../wallet/LinkButton";
import { ServiceError } from "../wallet/ServiceStates";
import { AmountPresets } from "./AmountPresets";
import { maskedAccount, rememberInFlight } from "./paymentMeta";
import { useBankAccounts, useRefreshMoney } from "./paymentQueries";
import { PaymentStatusView } from "./PaymentStatusView";

interface Values {
  readonly bankAccountId: string;
  readonly amount: string;
}

interface Review {
  readonly request: WithdrawalRequest;
  readonly quote: WithdrawalQuote;
  /** One key per logical withdrawal, reused if the submit is retried. */
  readonly key: string;
}

export function accountLabel(account: BankAccount): string {
  return `${account.bankName} ${maskedAccount(account.accountNumberMasked)}`;
}

function WithdrawSkeleton(): React.JSX.Element {
  return (
    <Card>
      <SkeletonRoot label="Loading withdrawal form" className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </SkeletonRoot>
    </Card>
  );
}

function ReviewRow({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="type-small text-text-muted">{label}</dt>
      <dd className={strong ? "type-financial text-lg text-text-primary" : "type-financial text-text-primary"}>{value}</dd>
    </div>
  );
}

export interface WithdrawFlowProps {
  readonly pollDelaysMs?: readonly number[];
}

/** Form → platform quote → review → confirm → submit → the platform's status until it is final. */
export function WithdrawFlow({ pollDelaysMs }: WithdrawFlowProps): React.JSX.Element {
  const wallet = useWallet();
  const accounts = useBankAccounts();
  const refresh = useRefreshMoney();
  const { toast } = useToast();
  const [review, setReview] = useState<Review>();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [reference, setReference] = useState<string>();

  const available = wallet.data?.available;
  const schema = useMemo(
    () =>
      z.object({
        bankAccountId: z.string().min(1, "Choose a bank account."),
        amount: amountField(available === undefined ? {} : { max: available, maxMessage: `Your available balance is ${formatMoney(available)}.` }),
      }),
    [available],
  );

  const defaultAccount = accounts.data?.find((account) => account.isDefault) ?? accounts.data?.[0];
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { bankAccountId: defaultAccount?.id ?? "", amount: "" }, resetOptions: { keepDirtyValues: true }, mode: "onSubmit" });

  if (reference !== undefined) return <PaymentStatusView reference={reference} direction="WITHDRAWAL" {...(pollDelaysMs === undefined ? {} : { pollDelaysMs })} />;

  if (accounts.data === undefined) {
    return accounts.isError ? (
      <Card padding="none">
        <ServiceError error={accounts.error} onRetry={() => void accounts.refetch()} />
      </Card>
    ) : (
      <WithdrawSkeleton />
    );
  }

  if (accounts.data.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<Landmark className="size-5" />}
          title="No saved bank accounts"
          description="Add a bank account in your name before you withdraw."
          action={
            <LinkButton to="/wallet/bank-accounts" variant="primary" size="sm">
              Add a bank account
            </LinkButton>
          }
        />
      </Card>
    );
  }

  const bankAccounts = accounts.data;

  const quote = form.handleSubmit(async (values) => {
    const amount = parseMoney(values.amount);

    if (amount === undefined) return;

    setFailure(undefined);

    const request: WithdrawalRequest = { amount, bankAccountId: values.bankAccountId };

    try {
      const next = await accountServices.payments.quoteWithdrawal(request);
      const same = review !== undefined && review.request.amount === amount && review.request.bankAccountId === request.bankAccountId;

      setReview({ request, quote: next, key: same ? review.key : createIdempotencyKey() });
    } catch (cause) {
      const { applied, unmatched } = applyFieldErrors(cause, form.setError, ["amount", "bankAccountId"]);

      if (applied.length === 0 || Object.keys(unmatched).length > 0) setFailure(cause);
    }
  });

  const submit = async (): Promise<void> => {
    if (review === undefined) return;

    setSubmitting(true);
    setFailure(undefined);

    try {
      const payment = await accountServices.payments.requestWithdrawal(review.request, review.key);

      rememberInFlight({ reference: payment.reference, direction: "WITHDRAWAL" });
      refresh();
      toast({ kind: "wallet", tone: "info", title: "Payment initiated", message: `Withdrawal ${payment.reference} is with the platform. It is complete only once it is confirmed.` });
      setConfirming(false);
      setReference(payment.reference);
    } catch (cause) {
      logger.warn("flow", "Withdrawal request failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setConfirming(false);
      setFailure(cause);
    } finally {
      setSubmitting(false);
    }
  };

  if (review !== undefined) {
    const account = bankAccounts.find((item) => item.id === review.request.bankAccountId);
    const expired = Date.parse(review.quote.expiresAt) <= Date.now();

    return (
      <div className="space-y-4">
        <FormError error={failure} />
        <Card padding="none">
          <div className="border-b border-border px-4 py-3">
            <h2 className="type-h3 text-text-primary">Review withdrawal</h2>
            <p className="type-small mt-0.5 text-text-muted">Fees and the amount you receive are set by the platform.</p>
          </div>
          <dl className="divide-y divide-border px-4">
            <ReviewRow label="Amount" value={formatMoney(review.quote.amount)} />
            <ReviewRow label="Fee" value={formatMoney(review.quote.fee)} />
            <ReviewRow label="You receive" value={formatMoney(review.quote.netAmount)} strong />
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="type-small text-text-muted">To</dt>
              <dd className="type-body text-text-primary">{account === undefined ? "Saved account" : accountLabel(account)}</dd>
            </div>
          </dl>
          <p className="type-small border-t border-border px-4 py-2.5 text-text-muted">
            {expired ? "This quote has expired. Get a new one to continue." : `Quote valid until ${formatDateTime(review.quote.expiresAt)}.`}
          </p>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-sunken px-4 py-3">
            <Button
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setReview(undefined);
                setFailure(undefined);
              }}
            >
              Change
            </Button>
            {expired ? (
              <Button onClick={() => void quote()}>Get a new quote</Button>
            ) : (
              <Button
                onClick={() => {
                  setConfirming(true);
                }}
              >
                {failure === undefined ? "Withdraw" : "Try again"}
              </Button>
            )}
          </div>
        </Card>
        <ConfirmDialog
          open={confirming}
          onClose={() => {
            setConfirming(false);
          }}
          onConfirm={submit}
          loading={submitting}
          title="Confirm withdrawal"
          confirmLabel={`Withdraw ${formatMoney(review.quote.amount)}`}
          description={`${formatMoney(review.quote.netAmount)} will be sent to ${account === undefined ? "your saved account" : accountLabel(account)} after a ${formatMoney(review.quote.fee)} fee.`}
        />
      </div>
    );
  }

  const busy = form.formState.isSubmitting;
  const accountError = form.formState.errors.bankAccountId?.message;

  return (
    <Card>
      <form onSubmit={(event) => void quote(event)} noValidate className="space-y-5">
        <FormError error={failure} />
        <Field label="Bank account" error={accountError} required>
          {(control) => (
            <select
              {...control}
              {...form.register("bankAccountId")}
              disabled={busy}
              className="h-10 w-full rounded-sm border border-border bg-surface-sunken px-3 text-base text-text-primary focus-ring"
            >
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                  {account.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="space-y-3">
          <Input
            label="Amount"
            prefix={currentCurrency().symbol}
            inputMode="decimal"
            autoComplete="off"
            disabled={busy}
            hint={available === undefined ? "The platform checks your available balance." : `Available to withdraw: ${formatMoney(available)}`}
            error={form.formState.errors.amount?.message}
            {...form.register("amount")}
          />
          <AmountPresets
            disabled={busy}
            onPick={(preset) => {
              form.setValue("amount", amountInputValue(preset), { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
            }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <LinkButton to="/wallet/bank-accounts" variant="ghost" size="sm">
            Manage bank accounts
          </LinkButton>
          <Button type="submit" loading={busy}>
            Review withdrawal
          </Button>
        </div>
      </form>
    </Card>
  );
}
