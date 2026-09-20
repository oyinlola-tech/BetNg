import { formatCountdown } from "@betng/ui-core";
import { useNow } from "../hooks/useNow";
import { Text, type TextProps } from "./Text";

export function Countdown({
  to,
  ...rest
}: { readonly to: string } & TextProps): React.JSX.Element {
  const now = useNow(1000);

  return (
    <Text tabular {...rest}>
      {formatCountdown(Date.parse(to) - now)}
    </Text>
  );
}
