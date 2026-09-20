import { View } from "react-native";
import { formatDateTime, formatMoney, formatSignedMoney } from "@betng/ui-core";
import {
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonRows,
  Text,
} from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

export function TransactionsScreen(): React.JSX.Element {
  const t = useTheme();
  const version = useAccountVersion();
  const transactions = useAsync(
    () => getDataSource().listTransactions(),
    [version],
  );

  return (
    <Screen
      refreshing={transactions.refreshing}
      onRefresh={() => void transactions.refresh()}
    >
      <Card>
        {transactions.error !== undefined ? (
          <ErrorState
            error={transactions.error}
            onRetry={() => void transactions.refresh()}
          />
        ) : transactions.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={8} />
          </View>
        ) : transactions.data.length === 0 ? (
          <EmptyState title="No transactions" />
        ) : (
          transactions.data.map((tx, i) => (
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
                  {formatDateTime(tx.createdAt)} · balance{" "}
                  {formatMoney(tx.balanceAfter)}
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
    </Screen>
  );
}
