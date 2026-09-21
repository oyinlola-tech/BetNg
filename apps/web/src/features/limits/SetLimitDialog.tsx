import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { LimitKind, ResponsibleGamingLimit } from "@betng/contracts";
import { DataSourceError, currentCurrency, formatDateTime, parseMoney } from "@betng/ui-core";
import { Button, Dialog, FormError, Input, applyFieldErrors, useToast } from "@betng/ui-web";
import { logger } from "../../services/runtime";
import { amountField, amountInputValue } from "../wallet/amount";
import { LIMIT_LABEL, formatLimitValue, isMoneyLimit } from "./limitMeta";
import { useSetLimit } from "./limitQueries";

interface Values {
  readonly value: string;
}

const minutesField = z
  .string()
  .trim()
  .regex(/^\d{1,4}$/, "Enter whole minutes, for example 90.")
  .refine((text) => Number(text) >= 1 && Number(text) <= 1440, "Choose between 1 minute and 24 hours (1440 minutes).");

function LimitForm({ kind, current, onClose }: { readonly kind: LimitKind; readonly current: ResponsibleGamingLimit | undefined; readonly onClose: () => void }): React.JSX.Element {
  const money = isMoneyLimit(kind);
  const schema = useMemo(() => z.object({ value: money ? amountField() : minutesField }), [money]);
  const setLimit = useSetLimit();
  const { toast } = useToast();
  const [failure, setFailure] = useState<unknown>();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { value: current === undefined ? "" : money ? amountInputValue(current.value) : String(current.value) },
    mode: "onSubmit",
  });

  const submit = form.handleSubmit(async (values) => {
    const value = money ? parseMoney(values.value) : Number(values.value);

    if (value === undefined) return;

    setFailure(undefined);

    try {
      const summary = await setLimit.mutateAsync({ kind, value });
      const saved = summary.limits.find((limit) => limit.kind === kind);
      const waiting = saved?.pendingValue !== undefined && saved.pendingEffectiveAt !== undefined;

      toast({
        tone: "info",
        title: "Limit updated",
        message: waiting
          ? `${LIMIT_LABEL[kind]}: ${formatLimitValue(kind, saved.pendingValue ?? value)} takes effect on ${formatDateTime(saved.pendingEffectiveAt ?? "")}.`
          : `${LIMIT_LABEL[kind]} is now ${formatLimitValue(kind, saved?.value ?? value)}.`,
      });
      onClose();
    } catch (cause) {
      logger.warn("flow", "Setting a limit failed", { kind, code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

      const { applied, unmatched } = applyFieldErrors(cause, form.setError, ["value"]);

      if (applied.length === 0 || Object.keys(unmatched).length > 0) setFailure(cause);
    }
  });

  const busy = form.formState.isSubmitting;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <FormError error={failure} />
      <Input
        label={money ? "Limit amount" : "Minutes per session"}
        inputMode={money ? "decimal" : "numeric"}
        autoComplete="off"
        disabled={busy}
        {...(money ? { prefix: currentCurrency().symbol } : {})}
        hint="A lower limit applies at once. A higher limit, or removing one, waits out a cooling-off period set by the platform."
        error={form.formState.errors.value?.message}
        {...form.register("value")}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save limit
        </Button>
      </div>
    </form>
  );
}

export interface SetLimitDialogProps {
  readonly kind: LimitKind | undefined;
  readonly current: ResponsibleGamingLimit | undefined;
  readonly onClose: () => void;
}

export function SetLimitDialog({ kind, current, onClose }: SetLimitDialogProps): React.JSX.Element {
  return (
    <Dialog open={kind !== undefined} onClose={onClose} title={kind === undefined ? "" : LIMIT_LABEL[kind]} size="sm">
      {kind !== undefined && <LimitForm key={kind} kind={kind} current={current} onClose={onClose} />}
    </Dialog>
  );
}
