import { View } from "react-native";
import { Lock } from "lucide-react-native";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../theme";
import { Button } from "./Button";
import { EmptyState } from "./States";

export function SignInPrompt({ title, description, reason }: { readonly title: string; readonly description: string; readonly reason: string }): React.JSX.Element {
  const t = useTheme();
  const { status, openAuth } = useAuth();
  const expired = status === "EXPIRED";

  return (
    <EmptyState
      icon={<Lock size={20} color={t.colors.textMuted} />}
      title={expired ? "Your session has ended" : title}
      description={expired ? "Log in again to pick up where you left off." : description}
      action={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label="Log in"
            onPress={() => {
              openAuth(expired ? "expired" : "login", { reason });
            }}
          />
          {!expired && (
            <Button
              label="Create account"
              variant="secondary"
              onPress={() => {
                openAuth("register", { reason });
              }}
            />
          )}
        </View>
      }
    />
  );
}
