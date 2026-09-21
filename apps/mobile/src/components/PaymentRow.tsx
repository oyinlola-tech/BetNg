import { View } from "react-native";
import type { PaymentRecord } from "@betng/contracts";
import { formatDateTime, formatMoney } from "@betng/ui-core";
import { paymentStatusView } from "../lib/payments";
import { useTheme } from "../theme";
import { toneColors } from "../theme/tone";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export function PaymentStatusBadge({ status }: { readonly status: PaymentRecord["status"] }): React.JSX.Element {
  const t = useTheme();
  const view = paymentStatusView(status);
  const colors = toneColors(t.colors, view.tone);

  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: 6, height: 20, borderRadius: t.radius.xs, justifyContent: "center" }}>
      <Text variant="caps" style={{ fontSize: 10, color: colors.fg }}>
        {view.label}
      </Text>
    </View>
  );
}

export function PaymentRow({
  payment,
  first,
  onPress,
}: {
  readonly payment: PaymentRecord;
  readonly first: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${payment.direction === "DEPOSIT" ? "Deposit" : "Withdrawal"} ${formatMoney(payment.amount)}, ${paymentStatusView(payment.status).label}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.colors.border,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontWeight: "500" }}>
          {payment.direction === "DEPOSIT" ? "Deposit" : "Withdrawal"}
        </Text>
        <Text variant="caption" tone="muted">
          {formatDateTime(payment.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text variant="bodyStrong" tabular>
          {formatMoney(payment.amount)}
        </Text>
        <PaymentStatusBadge status={payment.status} />
      </View>
    </Pressable>
  );
}
