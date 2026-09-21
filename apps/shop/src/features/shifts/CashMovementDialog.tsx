import { useState } from "react";
import type { CashMovementRequest } from "@betng/contracts";
import { currentCurrency, formatMoney } from "@betng/ui-core";
import { Button, Input, Modal, Textarea, presentError, useToast } from "@betng/ui-web";
import { useRecordCash } from "../../hooks/queries";
import { useOperationKey } from "../../hooks/useOperationKey";
import { errorMessage, parseAmount } from "./money";

export interface CashMovementDialogProps {
  readonly type: CashMovementRequest["type"] | undefined;
  readonly onClose: () => void;
}

export function CashMovementDialog({ type, onClose }: CashMovementDialogProps): React.JSX.Element {
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ readonly amount?: string; readonly note?: string }>({});
  const record = useRecordCash();
  const key = useOperationKey();
  const { toast } = useToast();
  const cashIn = type === "CASH_IN";

  const close = (): void => {
    if (record.isPending) return;
    setAmountText("");
    setNote("");
    setErrors({});
    record.reset();
    key.renew();
    onClose();
  };

  const submit = (): void => {
    if (type === undefined) return;

    const amount = parseAmount(amountText);
    const trimmed = note.trim();
    const next = {
      ...(amount === undefined || amount < 1 ? { amount: "Enter an amount greater than zero." } : {}),
      ...(trimmed.length < 3 ? { note: "Say why the cash is moving (at least 3 characters)." } : {}),
    };

    setErrors(next);
    if (amount === undefined || amount < 1 || trimmed.length < 3) return;

    record.mutate(
      { request: { type, amount, note: trimmed }, key: key.current() },
      {
        onSuccess: () => {
          toast({ tone: "success", title: cashIn ? "Cash in recorded" : "Cash out recorded", message: formatMoney(amount) });
          close();
        },
      },
    );
  };

  const edit = (apply: () => void): void => {
    apply();
    key.renew();
  };

  return (
    <Modal
      open={type !== undefined}
      onClose={close}
      title={cashIn ? "Cash in" : "Cash out"}
      description={cashIn ? "Cash added to the drawer, such as a float top-up." : "Cash taken out of the drawer, such as a safe drop."}
      size="sm"
      footer={
        <>
          <Button variant="ghost" disabled={record.isPending} onClick={close}>
            Cancel
          </Button>
          <Button form="cash-movement" type="submit" loading={record.isPending}>
            {record.isError ? "Try again" : cashIn ? "Record cash in" : "Record cash out"}
          </Button>
        </>
      }
    >
      <form
        id="cash-movement"
        noValidate
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label="Amount"
          prefix={currentCurrency().symbol}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={amountText}
          error={errors.amount}
          onChange={(event) => {
            edit(() => {
              setAmountText(event.target.value);
            });
          }}
        />
        <Textarea
          label="Note (required)"
          maxLength={160}
          rows={2}
          value={note}
          error={errors.note}
          hint="Recorded with your name in the shop ledger."
          onChange={(event) => {
            edit(() => {
              setNote(event.target.value);
            });
          }}
        />
        {record.isError && (
          <p role="alert" className="rounded-sm bg-danger-subtle px-3 py-2 text-sm text-danger">
            {presentError(record.error).title}: {errorMessage(record.error, presentError(record.error).message)}
          </p>
        )}
      </form>
    </Modal>
  );
}
