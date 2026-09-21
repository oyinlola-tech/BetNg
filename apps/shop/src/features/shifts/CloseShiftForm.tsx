import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { NGN_DENOMINATIONS, type CashierShift } from "@betng/contracts";
import { DataSourceError, formatMoney } from "@betng/ui-core";
import { Button, CodeInput, Panel, Textarea, presentError } from "@betng/ui-web";
import { useCloseShift } from "../../hooks/queries";
import { useOperationKey } from "../../hooks/useOperationKey";
import { errorMessage } from "./money";

const MAX_COUNT = 100_000;

export function CloseShiftForm({ shift, onClosed }: { readonly shift: CashierShift; readonly onClosed: (shift: CashierShift) => void }): React.JSX.Element {
  const [counts, setCounts] = useState<Readonly<Record<number, string>>>({});
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const close = useCloseShift();
  const key = useOperationKey();
  const pinRejected = close.error instanceof DataSourceError && (close.error.code === "INVALID_CREDENTIALS" || close.error.detail.fields?.["pin"] !== undefined);

  const rows = useMemo(() => NGN_DENOMINATIONS.map((denomination) => ({ denomination, count: Number.parseInt(counts[denomination] ?? "", 10) || 0 })), [counts]);
  const asEntered = rows.reduce((total, row) => total + row.denomination * row.count, 0);

  const submit = (): void => {
    if (rows.every((row) => row.count === 0)) {
      setProblem("Enter the count for at least one denomination. Enter 0 where there are none.");

      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setProblem("Enter your 4-digit PIN to confirm.");

      return;
    }

    setProblem(undefined);
    close.mutate(
      { shiftId: shift.id, request: { counted: rows, pin, ...(note.trim() === "" ? {} : { note: note.trim() }) }, key: key.current() },
      {
        onSuccess: (closed) => {
          key.renew();
          onClosed(closed);
        },
        onError: () => {
          setPin("");
        },
      },
    );
  };

  return (
    <Panel title="Count the drawer" description="Count every note by denomination. The platform totals the count and works out any discrepancy." className="max-w-2xl">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <table className="w-full text-base">
          <caption className="sr-only">Cash count by denomination</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-caps text-text-muted">
              <th scope="col" className="py-2 font-semibold">Denomination</th>
              <th scope="col" className="py-2 font-semibold">Count</th>
              <th scope="col" className="py-2 text-right font-semibold">Amount (as entered)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = formatMoney(row.denomination, { fraction: "never" });

              return (
                <tr key={row.denomination} className="border-b border-border last:border-0">
                  <th scope="row" className="py-1.5 text-left font-display font-semibold tabular">{label}</th>
                  <td className="py-1.5">
                    <input
                      aria-label={`Number of ${label} notes`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={counts[row.denomination] ?? ""}
                      placeholder="0"
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                        const bounded = digits === "" ? "" : String(Math.min(MAX_COUNT, Number(digits)));

                        setCounts((current) => ({ ...current, [row.denomination]: bounded }));
                        key.renew();
                      }}
                      className="h-9 w-28 rounded-sm border border-border bg-surface-sunken px-3 text-right tabular outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
                    />
                  </td>
                  <td className="py-1.5 text-right tabular text-text-secondary">{formatMoney(row.denomination * row.count)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong">
              <th scope="row" colSpan={2} className="py-2 text-left font-semibold">
                Counted (as entered)
              </th>
              <td className="py-2 text-right font-display text-lg font-semibold tabular" data-testid="counted-as-entered">{formatMoney(asEntered)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-1 text-sm text-text-muted">This sum only helps you check your typing. The platform's count and discrepancy are shown after you close.</p>

        <Textarea
          className="mt-4"
          label="Note (optional)"
          rows={2}
          maxLength={300}
          value={note}
          hint="Explain any difference you already know about."
          onChange={(event) => {
            setNote(event.target.value);
            key.renew();
          }}
        />

        <CodeInput className="mt-4" label="Your cashier PIN" length={4} masked value={pin} onChange={setPin} disabled={close.isPending} error={pinRejected ? "That PIN is not correct. The shift is still open." : undefined} />

        {problem !== undefined && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {problem}
          </p>
        )}
        {close.isError && !pinRejected && (
          <div role="alert" className="mt-3 rounded-sm border border-danger/30 bg-danger-subtle px-3 py-2 text-sm">
            <p className="font-semibold text-danger">{presentError(close.error).title}</p>
            <p className="text-text-primary">{errorMessage(close.error, presentError(close.error).message)} The shift is still open; submitting again is safe.</p>
          </div>
        )}

        <Button type="submit" size="lg" className="mt-4" loading={close.isPending} leadingIcon={<Lock className="size-4" />}>
          Close shift
        </Button>
      </form>
    </Panel>
  );
}
