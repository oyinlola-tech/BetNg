import { View, type ViewProps } from "react-native";
import { useTheme } from "../theme";

export function Card({ style, ...rest }: ViewProps): React.JSX.Element {
  const t = useTheme();

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radius.md,
          overflow: "hidden",
        },
        style,
      ]}
    />
  );
}

export function Divider(): React.JSX.Element {
  const t = useTheme();

  return <View style={{ height: 1, backgroundColor: t.colors.border }} />;
}
