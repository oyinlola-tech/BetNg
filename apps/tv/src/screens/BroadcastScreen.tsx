import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { useBroadcastDirector, type BroadcastScene } from "../hooks/useBroadcastDirector";
import { useBroadcastMode } from "../hooks/useBroadcastMode";
import { BoardScreen } from "./BoardScreen";
import { FeedScreen } from "./FeedScreen";
import { ResultsScreen } from "./ResultsScreen";
import { StandingsScreen } from "./StandingsScreen";
import { UpcomingScreen } from "./UpcomingScreen";

const SCENES: Readonly<Record<BroadcastScene, () => React.JSX.Element>> = {
  board: BoardScreen,
  feed: FeedScreen,
  results: ResultsScreen,
  standings: StandingsScreen,
  upcoming: UpcomingScreen,
};

function isScene(value: string | null): value is BroadcastScene {
  return value !== null && value in SCENES;
}

/** Auto Broadcast: the director runs only while this route is mounted. */
export function BroadcastScreen(): React.JSX.Element {
  const [params] = useSearchParams();
  const [, setBroadcast] = useBroadcastMode();
  const requested = params.get("scene");
  const scene: BroadcastScene = isScene(requested) ? requested : "board";
  const Scene = SCENES[scene];

  useBroadcastDirector(true);

  useEffect(() => {
    setBroadcast(true);

    return () => {
      setBroadcast(false);
    };
  }, [setBroadcast]);

  return (
    <div className="h-full">
      <div key={`${scene}:${params.get("league") ?? ""}`} className="h-full animate-fade-in">
        <Scene />
      </div>
    </div>
  );
}
