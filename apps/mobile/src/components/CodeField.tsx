import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

export interface CodeFieldProps {
  readonly label: string;
  readonly length: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onComplete?: (value: string) => void;
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

/** Boxes drawn over one real input, so paste and SMS autofill deliver the whole code at once. */
export function CodeField({ label, length, value, onChange, onComplete, error, disabled = false, autoFocus = false }: CodeFieldProps): React.JSX.Element {
  const t = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="secondary" style={{ fontWeight: "500" }}>
        {label}
      </Text>
      <Pressable
        accessible={false}
        onPress={() => {
          input.current?.focus();
        }}
        style={{ flexDirection: "row", gap: 8, opacity: disabled ? 0.6 : 1 }}
      >
        {Array.from({ length }, (_, index) => {
          const active = focused && index === Math.min(value.length, length - 1);

          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: t.radius.sm,
                borderWidth: active ? 2 : 1,
                borderColor: error !== undefined ? t.colors.danger : active ? t.colors.brand : t.colors.border,
                backgroundColor: t.colors.surfaceSunken,
              }}
            >
              <Text variant="title" tabular>
                {value[index] ?? ""}
              </Text>
            </View>
          );
        })}
        <TextInput
          ref={input}
          accessibilityLabel={label}
          accessibilityHint={error ?? `${String(length)} digits`}
          value={value}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          caretHidden
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          onChangeText={(text) => {
            const next = text.replace(/\D/g, "").slice(0, length);

            onChange(next);
            if (next.length === length) onComplete?.(next);
          }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.01, color: "transparent" }}
        />
      </Pressable>
      {error !== undefined && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}
