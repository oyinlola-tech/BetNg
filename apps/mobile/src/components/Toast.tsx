import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { Text } from "./Text";

interface ToastContextValue {
  readonly toast: (text: string, tone?: "info" | "success" | "danger") => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<
    | { readonly text: string; readonly tone: "info" | "success" | "danger" }
    | undefined
  >(undefined);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback(
    (text: string, tone: "info" | "success" | "danger" = "info") => {
      setCurrent({ text, tone });
    },
    [],
  );

  useEffect(() => {
    if (current === undefined) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrent(undefined);
      });
    }, 3600);

    return () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, [current, opacity]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current !== undefined && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            top: insets.top + 8,
            opacity,
          }}
        >
          <View
            style={{
              backgroundColor: t.colors.surfaceElevated,
              borderRadius: t.radius.md,
              borderWidth: 1,
              borderColor:
                current.tone === "success"
                  ? t.colors.success
                  : current.tone === "danger"
                    ? t.colors.danger
                    : t.colors.border,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            <Text variant="bodyStrong">{current.text}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);

  if (ctx === undefined)
    throw new Error("useToast must be used within ToastProvider");

  return ctx;
}
