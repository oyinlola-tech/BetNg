/**
 * The virtual football lobby.
 *
 * Mobile's own screen, not a rendering of the web page: a touch list with
 * its own navigation. It reads the same endpoint the web lobby does.
 */

import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useMatches } from "../hooks";
import type { Match } from "../types";

export interface LobbyScreenProps {
  readonly onSelectMatch: (matchId: string) => void;
}

export function LobbyScreen({
  onSelectMatch,
}: LobbyScreenProps): React.JSX.Element {
  const { matches, loading, error } = useMatches();

  if (loading) {
    return (
      <View style={styles.centred}>
        <ActivityIndicator accessibilityLabel="Loading matches" />
      </View>
    );
  }

  if (error !== undefined) {
    return (
      <View style={styles.centred}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const renderMatch = ({ item }: { item: Match }): React.JSX.Element => (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        onSelectMatch(item.id);
      }}
      style={styles.row}
    >
      <Text style={styles.rowTitle}>{item.id}</Text>
      <Text style={styles.rowStatus}>{item.status}</Text>
    </Pressable>
  );

  return (
    <FlatList
      data={[...matches]}
      keyExtractor={(item) => item.id}
      renderItem={renderMatch}
      ListEmptyComponent={
        <View style={styles.centred}>
          <Text>No matches are scheduled.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: "center", flex: 1, justifyContent: "center" },
  error: { color: "#b00020" },
  row: { borderBottomColor: "#eee", borderBottomWidth: 1, padding: 16 },
  rowStatus: { color: "#666", fontSize: 12 },
  rowTitle: { fontSize: 15, fontWeight: "600" },
});
