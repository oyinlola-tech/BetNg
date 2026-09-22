import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DataSourceError, currentCurrency, formatMoney, parseMoney } from "@betng/ui-core";
import { Button, Dialog, FormError, Input, applyFieldErrors, useToast } from "@betng/ui-web";
import { useDeposit, useWithdraw } from "../../hooks/accountQueries";
import { logger } from "../../services/runtime";
import { OfflineMoneyNotice } from "../payments/OfflineMoneyNotice";
import { amountField } from "./amount";

export type WalletAction = "DEPOSIT" | "WITHDRAW";

export interface WalletActionDialogProps {
  readonly action: WalletAction | undefined;
  /** The platform's available balance, used only to catch an obvious over-withdrawal before sending. */
  readonly available: number | undefined;
  readonly onClose: () => void;
}

const COPY: Record<WalletAction, { readonly title: string; readonly submit: string; readonly done: string; readonly hint: string }> = {
  DEPOSIT: {
    title: "Add simulated funds",
    submit: "Add funds",
    done: "Funds added",
    hint: "Simulated funds. No payment is taken and nothing here has real-world value.",
  },
  WITHDRAW: {
    title: "Withdraw simulated funds",
    submit: "Withdraw",
    done: "Withdrawal made",
    hint: "Simulated funds. Nothing is paid out to a bank or card.",
  },
};

const PRESETS: readonly number[] = [100_000, 500_000, 1_000_000];

interface Values {
  readonly amount: string;
}

function ActionForm({ action, available, onClose }: { readonly action: WalletAction; readonly available: number | undefined; readonly onClose: () => void }): React.JSX.Element {
  const copy = COPY[action];
  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const { toast } = useToast();
  const [failure, setFailure] = useState<unknown>();

  const schema = useMemo(
    () =>
      z.object({
        amount: amountField(
          action === "WITHDRAW" && available !== undefined
            ? { max: available, maxMessage: `You can withdraw up to ${formatMoney(available)}.` }
            : {},
        ),
      }),
    [action, available],
  );

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { amount: "" }, mode: "onSubmit" });
  const { setFocus } = form;

  useEffect(() => {
    setFocus("amount");
  }, [setFocus]);

  const submit = form.handleSubmit(async (values) => {
    const amount = parseMoney(values.amount);

    if (amount === undefined) return;

    setFailure(undefined);

    try {
      await (action === "DEPOSIT" ? deposit : withdraw).mutateAsync(amount);
      toast({ kind: "wallet", tone: "success", title: copy.done, message: `${formatMoney(amount)} in simulated funds. Your balance is being refreshed.` });
      onClose();
    } catch (cause) {
      logger.warn("flow", `Wallet ${action.toLowerCase()} failed`, { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

      const { applied, unmatched } = applyFieldErrors(cause, form.setError, ["amount"]);

      if (applied.length === 0 || Object.keys(unmatched).length > 0) setFailure(cause);
    }
  });

  const busy = form.formState.isSubmitting;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <OfflineMoneyNotice action={action === "DEPOSIT" ? "A deposit" : "A withdrawal"} />
      <FormError error={failure} />
      <Input
        label="Amount"
        prefix={currentCurrency().symbol}
        inputMode="decimal"
        autoComplete="off"
        disabled={busy}
        hint={copy.hint}
        error={form.formState.errors.amount?.message}
        {...form.register("amount")}
      />
      <div role="group" aria-label="Quick amounts" className="flex gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => {
              form.setValue("amount", formatMoney(preset, { currency: { ...currentCurrency(), symbol: "" } }), { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
            }}
          >
            {formatMoney(preset, { fraction: "never" })}
          </Button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            form.reset();
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {copy.submit}
        </Button>
      </div>
    </form>
  );
}

export function WalletActionDialog({ action, available, onClose }: WalletActionDialogProps): React.JSX.Element {
  return (
    <Dialog open={action !== undefined} onClose={onClose} title={action === undefined ? "" : COPY[action].title} size="sm">
      {action !== undefined && <ActionForm key={action} action={action} available={available} onClose={onClose} />}
    </Dialog>
  );
}
