import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { minTouchTarget } from "@betng/design-tokens";

export interface PressableProps extends Omit<RNPressableProps, "style"> {
  readonly style?: StyleProp<ViewStyle>;
  readonly pressedStyle?: StyleProp<ViewStyle>;
}

/* Every touch target is at least 44dp and dims on press, so feedback is consistent across the app. */
export function Pressable({
  style,
  pressedStyle,
  ...rest
}: PressableProps): React.JSX.Element {
  return (
    <RNPressable
      {...rest}
      style={({ pressed }) => [
        { minHeight: minTouchTarget },
        style,
        pressed && [{ opacity: 0.75 }, pressedStyle],
      ]}
    />
  );
}
