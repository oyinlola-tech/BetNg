import { forwardRef, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  readonly label: string;
  readonly error?: string | undefined;
  readonly hint?: string;
  /** Adds a show/hide toggle and hides the text by default. */
  readonly secure?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, hint, secure = false, editable = true, onFocus, onBlur, ...rest }, ref) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="secondary" style={{ fontWeight: "500" }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 48,
          borderRadius: t.radius.sm,
          borderWidth: 1,
          borderColor: error !== undefined ? t.colors.danger : focused ? t.colors.brand : t.colors.border,
          backgroundColor: t.colors.surfaceSunken,
          opacity: editable ? 1 : 0.6,
        }}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          editable={editable}
          secureTextEntry={secure && !visible}
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.brand}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={{ flex: 1, height: "100%", paddingHorizontal: 14, fontSize: t.text.md, color: t.colors.textPrimary }}
          {...rest}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            accessibilityState={{ selected: visible }}
            hitSlop={6}
            onPress={() => {
              setVisible((v) => !v);
            }}
            style={{ width: 48, alignItems: "center", justifyContent: "center" }}
          >
            {visible ? <EyeOff size={18} color={t.colors.textMuted} /> : <Eye size={18} color={t.colors.textMuted} />}
          </Pressable>
        )}
      </View>
      {error !== undefined ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint !== undefined ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
