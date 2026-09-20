/**
 * The mobile client's navigation.
 *
 * A single stack held in state rather than a navigation library. The app has
 * two screens in this phase, and adding React Navigation before there are
 * tabs, deep links or nested stacks to justify it would be a dependency
 * chosen ahead of the problem it solves. It arrives with the screens that
 * need it — the bet slip, wallet and history tabs.
 */

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LobbyScreen, MatchScreen } from "../screens";

type Route =
  | { readonly name: "lobby" }
  | { readonly name: "match"; readonly matchId: string };

export function AppNavigator(): React.JSX.Element {
  const [route, setRoute] = useState<Route>({ name: "lobby" });

  const openMatch = useCallback((matchId: string): void => {
    setRoute({ name: "match", matchId });
  }, []);

  const goBack = useCallback((): void => {
    setRoute({ name: "lobby" });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {route.name === "match" && (
          <Pressable accessibilityRole="button" onPress={goBack}>
            <Text style={styles.back}>‹ Matches</Text>
          </Pressable>
        )}
        <Text style={styles.title}>BetNG</Text>
      </View>

      {route.name === "lobby" ? (
        <LobbyScreen onSelectMatch={openMatch} />
      ) : (
        <MatchScreen matchId={route.matchId} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { color: "#0a7", marginBottom: 4 },
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: "700" },
});
