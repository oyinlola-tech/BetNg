import { useState } from "react";
import { Modal, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  formatDateTime,
  formatMoney,
  formatSignedMoney,
  parseStakeInput,
  currentCurrency,
} from "@betng/ui-core";
import {
  Button,
  Card,
  PaymentRow,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  SkeletonRows,
  Text,
  useToast,
} from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { presentError } from "../lib/errors";
import { useCanTransact } from "../hooks/useConnectivity";
import { useFlags } from "../hooks/useFlags";
import { OFFLINE_COMMAND_MESSAGE } from "../platform/offlineCache";
import { getAccountServices, getDataSource } from "../services/dataSource";
import { DepositSheet } from "./wallet/DepositSheet";
import { WithdrawSheet } from "./wallet/WithdrawSheet";
import { useTheme } from "../theme";

type Action = "DEPOSIT" | "WITHDRAW" | undefined;

export function WalletScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const { toast } = useToast();
  const version = useAccountVersion();
  const wallet = useAsync(() => getDataSource().getWallet(), [version]);
  const transactions = useAsync(
    () => getDataSource().listTransactions(),
    [version],
  );
  const payments = useFlags().paymentsEnabled;
  const online = useCanTransact();
  const history = useAsync(
    () => (payments ? getAccountServices().payments.listHistory({ pageSize: 6 }) : Promise.resolve(undefined)),
    [version, payments],
  );
  const [action, setAction] = useState<Action>(undefined);
  const [text, setText] = useState("5000");
  const [busy, setBusy] = useState(false);
  const amount = parseStakeInput(text);

  const refreshAll = (): void => {
    void wallet.refresh();
    void transactions.refresh();
    void history.refresh();
  };

  const viewPayment = (reference: string): void => {
    setAction(undefined);
    navigation.navigate("Payment", { reference });
  };

  const submit = async (): Promise<void> => {
    if (!online) {
      toast(OFFLINE_COMMAND_MESSAGE, "danger");
      return;
    }

    setBusy(true);

    try {
      if (action === "DEPOSIT") await getDataSource().deposit(amount);
      else await getDataSource().withdraw(amount);

      toast(
        `${action === "DEPOSIT" ? "Simulated deposit added" : "Simulated withdrawal made"} · ${formatMoney(amount)}`,
        "success",
      );
      setAction(undefined);
      void wallet.refresh();
      void transactions.refresh();
    } catch (error) {
      toast(presentError(error).message, "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {wallet.error !== undefined ? (
        <ErrorState
          error={wallet.error}
          onRetry={() => void wallet.refresh()}
        />
      ) : (
        <Card style={{ padding: 16 }}>
          <Text variant="caps" tone="muted">
            {payments ? "Available" : "Available · simulated"}
          </Text>
          <Text variant="display" tabular style={{ marginTop: 4 }}>
            {wallet.data === undefined
              ? "…"
              : formatMoney(wallet.data.available)}
          </Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
            <Text variant="caption" tone="secondary">
              Balance{" "}
              <Text variant="caption" tabular style={{ fontWeight: "700" }}>
                {wallet.data === undefined
                  ? "…"
                  : formatMoney(wallet.data.balance)}
              </Text>
            </Text>
            <Text variant="caption" tone="secondary">
              In open bets{" "}
              <Text variant="caption" tabular style={{ fontWeight: "700" }}>
                {wallet.data === undefined
                  ? "…"
                  : formatMoney(wallet.data.reserved)}
              </Text>
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <Button
              label="Deposit"
              onPress={() => {
                setAction("DEPOSIT");
              }}
              disabled={!online}
              style={{ flex: 1 }}
            />
            <Button
              label="Withdraw"
              variant="secondary"
              onPress={() => {
                setAction("WITHDRAW");
              }}
              disabled={!online}
              style={{ flex: 1 }}
            />
          </View>
          {!online && (
            <Text variant="caption" tone="warning" style={{ marginTop: 8 }}>
              {OFFLINE_COMMAND_MESSAGE}
            </Text>
          )}
        </Card>
      )}
      {payments ? (
        <>
          <SectionHeader title="Payments" />
          <Card>
            {history.data === undefined ? (
              history.error === undefined ? (
                <View style={{ padding: 12 }}>
                  <SkeletonRows rows={3} />
                </View>
              ) : (
                <ErrorState error={history.error} onRetry={() => void history.refresh()} />
              )
            ) : history.data.items.length === 0 ? (
              <EmptyState title="No payments yet" description="Deposits and withdrawals appear here with the status the platform reports." />
            ) : (
              history.data.items.map((p, i) => (
                <PaymentRow key={p.reference} payment={p} first={i === 0} onPress={() => { viewPayment(p.reference); }} />
              ))
            )}
          </Card>
        </>
      ) : (
      <Card
        style={{
          marginTop: 12,
          padding: 14,
          backgroundColor: t.colors.warningSubtle,
          borderColor: `${t.colors.warning}55`,
        }}
      >
        <Text variant="bodyStrong" tone="warning">
          Play-money only
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
          Deposits and withdrawals move a number in a database. No payment
          provider is connected.
        </Text>
      </Card>
      )}
      <SectionHeader
        title="Recent transactions"
        onPress={() => {
          navigation.navigate("Transactions");
        }}
      />
      <Card>
        {transactions.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={5} />
          </View>
        ) : transactions.data.length === 0 ? (
          <EmptyState title="No transactions" />
        ) : (
          transactions.data.slice(0, 6).map((tx, i) => (
            <View
              key={tx.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  variant="body"
                  numberOfLines={1}
                  style={{ fontWeight: "500" }}
                >
                  {tx.description}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatDateTime(tx.createdAt)}
                </Text>
              </View>
              <Text
                variant="bodyStrong"
                tabular
                tone={tx.amount >= 0 ? "success" : "primary"}
              >
                {formatSignedMoney(tx.amount)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <DepositSheet
        visible={payments && action === "DEPOSIT"}
        onClose={() => {
          setAction(undefined);
        }}
        onStarted={refreshAll}
        onViewStatus={viewPayment}
      />
      <WithdrawSheet
        visible={payments && action === "WITHDRAW"}
        onClose={() => {
          setAction(undefined);
        }}
        onRequested={refreshAll}
        onViewStatus={viewPayment}
      />
      <Modal
        visible={!payments && action !== undefined}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAction(undefined);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: t.colors.overlay,
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card
            style={{ padding: 16, backgroundColor: t.colors.surfaceElevated }}
          >
            <Text variant="title">
              {action === "DEPOSIT"
                ? "Simulated deposit"
                : "Simulated withdrawal"}
            </Text>
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                height: 48,
                borderRadius: t.radius.sm,
                borderWidth: 1,
                borderColor: t.colors.border,
                backgroundColor: t.colors.surfaceSunken,
                paddingHorizontal: 12,
              }}
            >
              <Text variant="title" tone="muted">
                {currentCurrency().symbol}
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                keyboardType="decimal-pad"
                autoFocus
                accessibilityLabel="Amount in naira"
                style={{
                  flex: 1,
                  marginLeft: 6,
                  fontSize: 18,
                  fontWeight: "700",
                  color: t.colors.textPrimary,
                }}
              />
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
              Play-money. No real payment takes place.
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setAction(undefined);
                }}
                style={{ flex: 1 }}
              />
              <Button
                label={action === "DEPOSIT" ? "Add funds" : "Withdraw"}
                loading={busy}
                disabled={amount <= 0}
                onPress={() => void submit()}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
