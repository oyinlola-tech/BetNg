import { useEffect, useMemo, useReducer, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, Info, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { DataSourceError, createIdempotencyKey, currentCurrency, formatDateTime, isAllowedExternalUrl, parseMoney } from "@betng/ui-core";
import { Button, Card, FormError, Input, RadioGroup, SectionHeading, useToast } from "@betng/ui-web";
import { analytics } from "../../services/analytics";
import { accountServices, env, logger } from "../../services/runtime";
import { amountField, amountInputValue } from "../wallet/amount";
import { LinkButton } from "../wallet/LinkButton";
import { AmountPresets } from "./AmountPresets";
import { OfflineMoneyNotice } from "./OfflineMoneyNotice";
import { INITIAL_DEPOSIT, depositReducer, isFinishedPhase, nextAttempt, type DepositPhase, type DepositState } from "./depositMachine";
import { METHOD_META, PAYMENT_METHODS, forgetInFlight, paymentPath, readInFlight, rememberInFlight } from "./paymentMeta";
import { usePaymentStatus, useRefreshMoney } from "./paymentQueries";
import { PaymentStatusCard } from "./PaymentStatusCard";

export const DEPOSIT_RETURN_PATH = "/payments/return";

const schema = z.object({
  amount: amountField(),
  method: z.enum(["CARD", "BANK_TRANSFER", "USSD"]),
});

type Values = z.input<typeof schema>;

export interface DepositFlowProps {
  /** Hosts a hosted checkout may live on; defaults to the build's allowlist. */
  readonly checkoutHosts?: readonly string[];
  readonly pollDelaysMs?: readonly number[];
  readonly onRedirect?: (url: string) => void;
}

function redirect(url: string): void {
  window.location.assign(url);
}

const FINISHED_COPY: Readonly<Record<Extract<DepositPhase, "confirmed" | "failed" | "cancelled" | "expired">, { readonly title: string; readonly body: string }>> = {
  confirmed: { title: "Deposit confirmed", body: "The platform confirmed this payment and credited your wallet." },
  failed: { title: "Deposit not completed", body: "The platform reports that this payment failed. Your wallet was not credited for it." },
  cancelled: { title: "Deposit cancelled", body: "This payment was cancelled. Your wallet was not credited for it." },
  expired: { title: "Deposit expired", body: "The payment window closed before the payment was completed. Your wallet was not credited for it." },
};

function PhaseHeading({ state }: { readonly state: DepositState }): React.JSX.Element | null {
  if (state.blockedRedirect === true) {
    return (
      <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-danger/40 bg-danger-subtle px-3 py-2.5 text-danger">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-semibold">Payment page blocked</p>
          <p className="text-sm text-text-secondary">
            The payment page is not on an approved provider address, so it was not opened. Nothing was charged here. Check the status below or start a new deposit.
          </p>
        </div>
      </div>
    );
  }

  if (state.phase === "confirmed" || state.phase === "failed" || state.phase === "cancelled" || state.phase === "expired") {
    const copy = FINISHED_COPY[state.phase];

    return (
      <div role="status">
        <h2 className="type-h3 text-text-primary">{copy.title}</h2>
        <p className="type-small mt-1 text-text-secondary">{copy.body}</p>
      </div>
    );
  }

  return null;
}

/**
 * Deposit as an explicit state machine:
 * idle → validating → initiating → redirecting | processing → confirmed | failed | cancelled | expired.
 * Only the platform's status moves a deposit to a finished state.
 */
export function DepositFlow({ checkoutHosts = env.checkoutHosts, pollDelaysMs, onRedirect = redirect }: DepositFlowProps): React.JSX.Element {
  const [state, dispatch] = useReducer(depositReducer, INITIAL_DEPOSIT);
  const { toast } = useToast();
  const refresh = useRefreshMoney();
  const resumable = useMemo(() => readInFlight(), []);
  const redirected = useRef<string | undefined>(undefined);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { amount: "", method: "CARD" }, mode: "onTouched" });

  const reference = state.payment?.reference;
  const watching = state.phase === "processing" && reference !== undefined;
  const status = usePaymentStatus(reference, "DEPOSIT", { enabled: watching, ...(pollDelaysMs === undefined ? {} : { pollDelaysMs }) });

  useEffect(() => {
    if (status.data !== undefined) dispatch({ type: "STATUS", payment: status.data });
  }, [status.data]);

  useEffect(() => {
    if (reference !== undefined && isFinishedPhase(state.phase) && state.blockedRedirect !== true) forgetInFlight(reference);
  }, [reference, state.phase, state.blockedRedirect]);

  useEffect(() => {
    if (state.phase !== "redirecting" || state.checkoutUrl === undefined || redirected.current === state.checkoutUrl) return;

    redirected.current = state.checkoutUrl;
    onRedirect(state.checkoutUrl);
  }, [state.phase, state.checkoutUrl, onRedirect]);

  const initiate = async (values: Values): Promise<void> => {
    const amount = parseMoney(values.amount);

    if (amount === undefined) {
      dispatch({ type: "INVALID" });

      return;
    }

    const attempt = nextAttempt(state, amount, values.method, createIdempotencyKey);

    dispatch({ type: "INITIATE", attempt });

    try {
      const result = await accountServices.payments.initiateDeposit({ amount, method: attempt.method, returnPath: DEPOSIT_RETURN_PATH }, attempt.key);
      const redirectAllowed = result.checkoutUrl !== undefined && isAllowedExternalUrl(result.checkoutUrl, checkoutHosts);

      if (result.checkoutUrl !== undefined && !redirectAllowed) logger.warn("flow", "Checkout redirect refused: host not on the allowlist", { reference: result.payment.reference });

      rememberInFlight({ reference: result.payment.reference, direction: "DEPOSIT" });
      dispatch({ type: "INITIATED", result, redirectAllowed });
      analytics.track("deposit_started", { method: attempt.method.toLowerCase() });
      refresh();
      if (result.checkoutUrl === undefined || redirectAllowed) toast({ kind: "wallet", tone: "info", title: "Payment initiated", message: `Reference ${result.payment.reference}. Waiting for the platform to confirm it.` });
    } catch (cause) {
      logger.warn("flow", "Deposit initiation failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      dispatch({ type: "INITIATE_FAILED", error: cause });
    }
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    dispatch({ type: "SUBMIT" });
    void form.handleSubmit(initiate, () => {
      dispatch({ type: "INVALID" });
    })(event);
  };

  const startAgain = (): void => {
    dispatch({ type: "RESET" });
    redirected.current = undefined;
    form.reset({ amount: "", method: form.getValues("method") });
  };

  const editing = state.phase === "idle" || state.phase === "validating" || state.phase === "initiating";
  const busy = state.phase === "validating" || state.phase === "initiating";

  if (editing) {
    const kycNeeded = state.error instanceof DataSourceError && state.error.code === "KYC_REQUIRED";

    return (
      <div className="space-y-4" data-phase={state.phase}>
        {resumable !== undefined && state.error === undefined && (
          <p className="type-small flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-border bg-surface px-3 py-2.5 text-text-secondary">
            <Info className="size-4 shrink-0 text-info" aria-hidden />
            <span>A payment started earlier may still be in progress.</span>
            <LinkButton to={paymentPath(resumable.reference, resumable.direction)} variant="ghost" size="sm">
              View its status
            </LinkButton>
          </p>
        )}
        <Card>
          <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={busy}>
            <OfflineMoneyNotice action="A deposit" />
            <FormError error={state.error} />
            {kycNeeded && (
              <LinkButton to="/kyc" size="sm">
                Verify your identity
              </LinkButton>
            )}
            <div className="space-y-3">
              <Input
                label="Amount"
                prefix={currentCurrency().symbol}
                inputMode="decimal"
                autoComplete="off"
                disabled={busy}
                hint="The platform may apply limits for your account and verification tier."
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
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <RadioGroup
                  legend="Payment method"
                  value={field.value}
                  onChange={field.onChange}
                  options={PAYMENT_METHODS.map((method) => ({ value: method, label: METHOD_META[method].label, description: METHOD_META[method].description, disabled: busy }))}
                />
              )}
            />
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
              <LinkButton to="/wallet" variant="ghost">
                Cancel
              </LinkButton>
              <Button type="submit" loading={busy}>
                {state.error !== undefined && state.attempt !== undefined ? "Try again" : "Continue to payment"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  const payment = state.payment;

  return (
    <div className="space-y-4" data-phase={state.phase}>
      <PhaseHeading state={state} />
      {state.phase === "redirecting" && (
        <p role="status" className="type-body flex items-center gap-2 text-text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Opening the provider's secure payment page…
        </p>
      )}
      {state.phase === "processing" && (
        <div role="status" className="flex items-start gap-2 text-text-secondary">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
          <p className="type-body">Waiting for the platform to confirm this payment. Your wallet is credited only once it is confirmed.</p>
        </div>
      )}
      {state.phase === "processing" && state.instructions !== undefined && (
        <Card>
          <SectionHeading as="h2">{state.instructions.title}</SectionHeading>
          <ol className="type-body mt-3 list-decimal space-y-1.5 pl-5 text-text-primary">
            {state.instructions.lines.map((line, index) => (
              <li key={`${String(index)}:${line}`}>{line}</li>
            ))}
          </ol>
          {state.expiresAt !== undefined && <p className="type-small mt-3 text-text-muted">Complete the payment before {formatDateTime(state.expiresAt)}.</p>}
        </Card>
      )}
      {status.error !== undefined && status.error !== null && state.phase === "processing" && <FormError error={status.error} />}
      {payment !== undefined && (
        <PaymentStatusCard
          payment={payment}
          footer={
            <>
              {state.phase === "processing" && (
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
              {state.blockedRedirect === true && (
                <LinkButton to={paymentPath(payment.reference, "DEPOSIT")} size="sm" icon={<ExternalLink className="size-3.5" aria-hidden />}>
                  Check status
                </LinkButton>
              )}
              {state.phase === "confirmed" && (
                <LinkButton to="/wallet" variant="primary" size="sm">
                  Back to wallet
                </LinkButton>
              )}
              {isFinishedPhase(state.phase) && (
                <Button variant={state.phase === "confirmed" ? "ghost" : "primary"} size="sm" onClick={startAgain}>
                  {state.phase === "confirmed" ? "Make another deposit" : "Start a new deposit"}
                </Button>
              )}
            </>
          }
        />
      )}
      {payment !== undefined && state.phase === "processing" && (
        <p className="type-small text-text-muted">
          You can leave this page; the status stays on{" "}
          <Link to={paymentPath(payment.reference, "DEPOSIT")} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
            the payment page
          </Link>
          .
        </p>
      )}
    </div>
  );
}
