import { FlatList, StyleSheet, Text, View } from "react-native";

import { useLiveMatch } from "../hooks";
import type { LiveEvent } from "../types";

export interface MatchScreenProps {
  readonly matchId: string;
}

export function MatchScreen({ matchId }: MatchScreenProps): React.JSX.Element {
  const { match, events, score, connected, error } = useLiveMatch(matchId);

  const renderEvent = ({ item }: { item: LiveEvent }): React.JSX.Element => (
    <View style={styles.event}>
      <Text style={styles.minute}>{item.minute}&apos;</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.scoreboard}>
        <Text style={styles.score}>
          {score.home} – {score.away}
        </Text>
        <Text style={styles.status}>
          {connected ? "LIVE" : "Reconnecting…"}
          {match !== undefined ? ` · ${match.status}` : ""}
        </Text>
      </View>

      {error !== undefined && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={[...events].reverse()}
        keyExtractor={(item) => `${item.matchId}-${String(item.sequence)}`}
        renderItem={renderEvent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  description: { flex: 1 },
  error: { color: "#b00020", padding: 16 },
  event: { flexDirection: "row", gap: 12, padding: 12 },
  minute: { fontVariant: ["tabular-nums"], width: 40 },
  score: { fontSize: 40, fontWeight: "700" },
  scoreboard: { alignItems: "center", paddingVertical: 24 },
  screen: { flex: 1 },
  status: { color: "#666", marginTop: 4 },
});
