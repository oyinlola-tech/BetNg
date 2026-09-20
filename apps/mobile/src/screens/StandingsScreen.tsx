import { useState } from "react";
import { View } from "react-native";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { LeagueId } from "@betng/contracts";
import { formatMatchday } from "@betng/ui-core";
import {
  Card,
  ErrorState,
  LeagueTable,
  Screen,
  SkeletonRows,
  Tabs,
  Text,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import type { RootStackParamList } from "../navigation/types";
import { getDataSource } from "../services/dataSource";

export function StandingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const params = useRoute<RouteProp<RootStackParamList, "Standings">>().params;
  const leagues = useAsync(() => getDataSource().listLeagues(), [], 30_000);
  const [selected, setSelected] = useState<string | undefined>(params.leagueId);
  const leagueId = selected ?? leagues.data?.[0]?.id;
  const standings = useAsync(
    () =>
      leagueId === undefined
        ? Promise.resolve(undefined)
        : getDataSource().getStandings(leagueId as LeagueId),
    [leagueId],
    15_000,
  );

  return (
    <Screen>
      {leagues.data !== undefined && (
        <Tabs
          segmented
          value={leagueId ?? ""}
          onChange={setSelected}
          items={leagues.data.map((l) => ({ value: l.id, label: l.code }))}
        />
      )}
      {standings.data !== undefined && (
        <Text variant="caption" tone="muted" style={{ marginTop: 12 }}>
          Season {standings.data.season} · after{" "}
          {formatMatchday(standings.data.matchdaysPlayed)}
        </Text>
      )}
      <Card style={{ marginTop: 8 }}>
        {standings.error !== undefined ? (
          <ErrorState
            error={standings.error}
            onRetry={() => void standings.refresh()}
          />
        ) : standings.data === undefined ? (
          <View style={{ padding: 12 }}>
            <SkeletonRows rows={12} />
          </View>
        ) : (
          <LeagueTable
            standings={standings.data}
            onTeam={(teamId) => {
              navigation.navigate("Team", { teamId });
            }}
          />
        )}
      </Card>
      <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>
        Top two and bottom two positions are highlighted.
      </Text>
    </Screen>
  );
}
