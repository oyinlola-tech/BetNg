import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import type { DepositInitiation, PaymentMethod } from "@betng/contracts";
import { formatMoney, parseStakeInput } from "@betng/ui-core";
import { Button, PaymentStatusBadge, Text, TextField } from "../../components";
import { env } from "../../configs/env";
import { useCanTransact } from "../../hooks/useConnectivity";
import { presentError } from "../../lib/errors";
import { createOperationKey } from "../../lib/ids";
import { paymentSummary } from "../../lib/payments";
import { isAllowedCheckoutUrl } from "../../platform/externalUrl";
import { OFFLINE_COMMAND_MESSAGE } from "../../platform/offlineCache";
import { getAccountServices } from "../../services/dataSource";
import { Choice, SheetFrame } from "./SheetFrame";

const METHODS: readonly { readonly value: PaymentMethod; readonly label: string }[] = [
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "USSD", label: "USSD" },
];

export function DepositSheet({
  visible,
  onClose,
  onStarted,
  onViewStatus,
}: {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onStarted: () => void;
  readonly onViewStatus: (reference: string) => void;
}): React.JSX.Element {
  const online = useCanTransact();
  const [text, setText] = useState("5000");
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [started, setStarted] = useState<DepositInitiation | undefined>(undefined);
  const key = useRef<string | undefined>(undefined);
  const amount = parseStakeInput(text);

  useEffect(() => {
    key.current = undefined;
  }, [text, method]);

  useEffect(() => {
    if (visible) return;

    setStarted(undefined);
    setError(undefined);
    key.current = undefined;
  }, [visible]);

  const submit = async (): Promise<void> => {
    if (!online) {
      setError(OFFLINE_COMMAND_MESSAGE);
      return;
    }

    setBusy(true);
    setError(undefined);
    key.current ??= createOperationKey();

    try {
      setStarted(await getAccountServices().payments.initiateDeposit({ amount, method }, key.current));
      onStarted();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const checkout = started?.checkoutUrl;
  const checkoutAllowed = checkout !== undefined && isAllowedCheckoutUrl(checkout, env.checkoutHosts);

  return (
    <SheetFrame visible={visible} title="Deposit" onClose={onClose}>
      {started === undefined ? (
        <>
          <TextField label="Amount" value={text} onChangeText={setText} keyboardType="decimal-pad" />
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
            {METHODS.map((m) => (
              <Choice key={m.value} label={m.label} selected={method === m.value} onPress={() => { setMethod(m.value); }} />
            ))}
          </View>
          {(error !== undefined || !online) && (
            <Text variant="caption" tone={error === undefined ? "warning" : "danger"} accessibilityLiveRegion="polite">
              {error ?? OFFLINE_COMMAND_MESSAGE}
            </Text>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button label={`Deposit ${amount > 0 ? formatMoney(amount) : ""}`.trim()} loading={busy} disabled={amount <= 0 || !online} onPress={() => void submit()} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="bodyStrong" tabular>
              {formatMoney(started.payment.amount)}
            </Text>
            <PaymentStatusBadge status={started.payment.status} />
          </View>
          <Text variant="body" tone="secondary">
            {paymentSummary(started.payment)}
          </Text>
          {started.instructions !== undefined && (
            <View style={{ gap: 4 }}>
              <Text variant="bodyStrong">{started.instructions.title}</Text>
              {started.instructions.lines.map((line, i) => (
                <Text key={i} variant="body" selectable>
                  {line}
                </Text>
              ))}
            </View>
          )}
          {checkout !== undefined && !checkoutAllowed && (
            <Text variant="caption" tone="danger">
              The payment page address could not be verified, so it was not opened. Contact support with reference {started.payment.reference}.
            </Text>
          )}
          {checkoutAllowed && <Button label="Continue to payment" onPress={() => void Linking.openURL(checkout)} />}
          <Button label="View status" variant="secondary" onPress={() => { onViewStatus(started.payment.reference); }} />
          <Button label="Close" variant="ghost" onPress={onClose} />
        </>
      )}
    </SheetFrame>
  );
}
