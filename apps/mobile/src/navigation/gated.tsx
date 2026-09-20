import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, SignInPrompt, Text } from "../components";
import { useAuth } from "../hooks/useAuth";

interface Gate {
  readonly title: string;
  readonly description: string;
  readonly reason: string;
  /** A tab has no native header, so the gate draws the screen's heading itself. */
  readonly heading?: string;
}

/** Wraps an account-only screen so nothing of it mounts (or fetches) while signed out. */
export function gated(Inner: React.ComponentType, gate: Gate): React.ComponentType {
  return function Gated() {
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();

    if (isAuthenticated) return <Inner />;

    return (
      <Screen style={gate.heading === undefined ? undefined : { paddingTop: insets.top + 12 }}>
        {gate.heading !== undefined && <Text variant="heading">{gate.heading}</Text>}
        <SignInPrompt title={gate.title} description={gate.description} reason={gate.reason} />
      </Screen>
    );
  };
}
