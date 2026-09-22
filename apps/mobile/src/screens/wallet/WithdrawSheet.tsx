import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { PaymentRecord, WithdrawalQuote } from "@betng/contracts";
import { formatMoney, parseStakeInput } from "@betng/ui-core";
import { Button, ErrorState, PaymentStatusBadge, SkeletonRows, Text, TextField } from "../../components";
import { useAsync } from "../../hooks/useAsync";
import { useCanTransact } from "../../hooks/useConnectivity";
import { presentError } from "../../lib/errors";
import { createOperationKey } from "../../lib/ids";
import { paymentSummary } from "../../lib/payments";
import { biometrics, confirmPresence } from "../../platform";
import { OFFLINE_COMMAND_MESSAGE } from "../../platform/offlineCache";
import { getAccountServices } from "../../services/dataSource";
import { AddBankAccount } from "./AddBankAccount";
import { Choice, SheetFrame } from "./SheetFrame";

export function WithdrawSheet({
  visible,
  onClose,
  onRequested,
  onViewStatus,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onRequested: () => void;
  readonly onViewStatus: (reference: string) => void;
}): React.JSX.Element {
  const online = useCanTransact();
  const accounts = useAsync(() => (visible ? getAccountServices().payments.listBankAccounts() : Promise.resolve(undefined)), [visible]);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [text, setText] = useState("");
  const [quote, setQuote] = useState<WithdrawalQuote | undefined>(undefined);
  const [result, setResult] = useState<PaymentRecord | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const key = useRef<string | undefined>(undefined);
  const amount = parseStakeInput(text);
  const selected = accountId ?? accounts.data?.find((a) => a.isDefault)?.id ?? accounts.data?.[0]?.id;

  useEffect(() => {
    key.current = undefined;
    setQuote(undefined);
  }, [text, selected]);

  useEffect(() => {
    if (visible) return;

    setResult(undefined);
    setQuote(undefined);
    setError(undefined);
    key.current = undefined;
  }, [visible]);

  const run = async (work: () => Promise<void>): Promise<void> => {
    if (!online) {
      setError(OFFLINE_COMMAND_MESSAGE);
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      await work();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = (): Promise<void> =>
    run(async () => {
      if (selected === undefined) return;
      if (!(await confirmPresence(biometrics, "Confirm your withdrawal"))) {
        setError("Withdrawal not confirmed.");
        return;
      }

      key.current ??= createOperationKey();
      setResult(await getAccountServices().payments.requestWithdrawal({ amount, bankAccountId: selected }, key.current));
      onRequested();
    });

  const body = (): React.ReactNode => {
    if (result !== undefined) {
      return (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="bodyStrong" tabular>
              {formatMoney(result.amount)}
            </Text>
            <PaymentStatusBadge status={result.status} />
          </View>
          <Text variant="body" tone="secondary">
            {paymentSummary(result)}
          </Text>
          <Button label="View status" variant="secondary" onPress={() => { onViewStatus(result.reference); }} />
          <Button label="Close" variant="ghost" onPress={onClose} />
        </>
      );
    }

    if (accounts.data === undefined) {
      return accounts.error === undefined ? <SkeletonRows rows={3} /> : <ErrorState error={accounts.error} onRetry={() => void accounts.refresh()} />;
    }

    if (accounts.data.length === 0) {
      return (
        <>
          <Text variant="body" tone="secondary">
            Add the bank account to pay out to.
          </Text>
          <AddBankAccount
            onSaved={(account) => {
              setAccountId(account.id);
              void accounts.refresh();
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </>
      );
    }

    return (
      <>
        <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
          {accounts.data.map((a) => (
            <Choice key={a.id} label={`${a.bankName} · ${a.accountNumberMasked}`} selected={selected === a.id} onPress={() => { setAccountId(a.id); }} />
          ))}
        </View>
        <TextField label="Amount" value={text} onChangeText={setText} keyboardType="decimal-pad" />
        {quote !== undefined && (
          <View style={{ gap: 2 }}>
            <Text variant="caption" tone="secondary">
              Fee {formatMoney(quote.fee)}
            </Text>
            <Text variant="bodyStrong" tabular>
              You receive {formatMoney(quote.netAmount)}
            </Text>
          </View>
        )}
        {(error !== undefined || !online) && (
          <Text variant="caption" tone={error === undefined ? "warning" : "danger"} accessibilityLiveRegion="polite">
            {error ?? OFFLINE_COMMAND_MESSAGE}
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          {quote === undefined ? (
            <Button
              label="Review"
              loading={busy}
              disabled={amount <= 0 || selected === undefined || !online}
              onPress={() =>
                void run(async () => {
                  if (selected !== undefined) setQuote(await getAccountServices().payments.quoteWithdrawal({ amount, bankAccountId: selected }));
                })
              }
              style={{ flex: 1 }}
            />
          ) : (
            <Button label="Withdraw" loading={busy} disabled={!online} onPress={() => void confirm()} style={{ flex: 1 }} />
          )}
        </View>
      </>
    );
  };

  return (
    <SheetFrame visible={visible} title="Withdraw" onClose={onClose}>
      {body()}
    </SheetFrame>
  );
}
