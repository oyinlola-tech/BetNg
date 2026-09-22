import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { PaymentRecord } from "@betng/contracts";
import { DataSourceError, formatDateTime, formatMoney } from "@betng/ui-core";
import { Button, Card, EmptyState, ErrorState, PaymentStatusBadge, Screen, SkeletonRows, Text } from "../components";
import { useAsync } from "../hooks/useAsync";
import { useFlags } from "../hooks/useFlags";
import { paymentPollDelay, paymentStatusView, paymentSummary } from "../lib/payments";
import type { RootStackParamList } from "../navigation/types";
import { getAccountServices } from "../services/dataSource";

async function readPayment(reference: string): Promise<PaymentRecord> {
  const { payments } = getAccountServices();

  try {
    return await payments.verifyDeposit(reference);
  } catch (error) {
    if (error instanceof DataSourceError && error.code === "NOT_FOUND") return payments.getWithdrawal(reference);

    throw error;
  }
}

function PaymentDetail({ reference }: { readonly reference: string }): React.JSX.Element {
  const payment = useAsync(() => readPayment(reference), [reference]);
  const settled = payment.data === undefined ? false : paymentStatusView(payment.data.status).settled;
  const polls = useRef(0);
  const { data, error, refresh } = payment;

  useEffect(() => {
    polls.current = 0;
  }, [reference]);

  useEffect(() => {
    const delay = data === undefined ? undefined : paymentPollDelay(data.status, polls.current);

    if (delay === undefined) return;

    const timer = setTimeout(() => {
      polls.current += 1;
      void refresh();
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [data, error, refresh]);

  if (payment.data === undefined) {
    return payment.error === undefined ? <SkeletonRows rows={4} /> : <ErrorState error={payment.error} onRetry={() => void payment.refresh()} />;
  }

  const p = payment.data;

  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="caps" tone="muted">
          {p.direction === "DEPOSIT" ? "Deposit" : "Withdrawal"}
        </Text>
        <PaymentStatusBadge status={p.status} />
      </View>
      <Text variant="display" tabular>
        {formatMoney(p.amount)}
      </Text>
      <Text variant="body" tone="secondary" accessibilityLiveRegion="polite">
        {paymentSummary(p)}
      </Text>
      {p.fee !== undefined && (
        <Text variant="caption" tone="muted">
          Fee {formatMoney(p.fee)}
          {p.netAmount === undefined ? "" : ` · Net ${formatMoney(p.netAmount)}`}
        </Text>
      )}
      <Text variant="caption" tone="muted">
        Reference {p.reference} · updated {formatDateTime(p.updatedAt)}
      </Text>
      {!settled && <Button label="Check status" variant="secondary" loading={payment.refreshing} onPress={() => void payment.refresh()} />}
    </Card>
  );
}

export function PaymentScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, "Payment">>();
  const flags = useFlags();

  return (
    <Screen>
      {flags.paymentsEnabled ? (
        <PaymentDetail reference={route.params.reference} />
      ) : (
        <Card>
          <EmptyState title="Payments are not available" description="Deposits and withdrawals are not switched on for this account yet." />
        </Card>
      )}
    </Screen>
  );
}
