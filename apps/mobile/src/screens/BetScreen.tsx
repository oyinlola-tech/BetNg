import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { ErrorState, Screen, SkeletonRows } from "../components";
import { useAccountVersion } from "../hooks/useAccount";
import { useAsync } from "../hooks/useAsync";
import type { RootStackParamList } from "../navigation/types";
import { getDataSource } from "../services/dataSource";
import { BetCard } from "./BetsScreen";

export function BetScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<RootStackParamList, "Bet">>();
  const navigation = useNavigation();
  const version = useAccountVersion();
  const bet = useAsync(() => getDataSource().getBet(route.params.betId), [route.params.betId, version]);

  return (
    <Screen refreshing={bet.refreshing} onRefresh={() => void bet.refresh()}>
      {bet.data !== undefined ? (
        <BetCard
          bet={bet.data}
          onMatch={(id) => {
            navigation.navigate("Match", { matchId: id });
          }}
        />
      ) : bet.error !== undefined ? (
        <ErrorState error={bet.error} onRetry={() => void bet.refresh()} />
      ) : (
        <SkeletonRows rows={4} />
      )}
    </Screen>
  );
}
