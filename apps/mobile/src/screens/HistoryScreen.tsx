import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Card,
  EmptyState,
  MatchRow,
  Screen,
  SkeletonRows,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { getDataSource } from "../services/dataSource";
import { useTheme } from "../theme";

export function HistoryScreen(): React.JSX.Element {
  const t = useTheme();
  const navigation = useNavigation();
  const viewed = useAsync(() => getDataSource().listViewedMatches(), []);

  return (
    <Screen>
      <Card>
        {viewed.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={5} />
          </View>
        ) : viewed.data.length === 0 ? (
          <EmptyState
            title="Nothing watched yet"
            description="Matches you open are listed here."
          />
        ) : (
          viewed.data.map((m, i) => (
            <View
              key={m.id}
              style={{
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: t.colors.border,
              }}
            >
              <MatchRow
                match={m}
                showLeague
                onPress={() => {
                  navigation.navigate("Match", { matchId: m.id });
                }}
              />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
