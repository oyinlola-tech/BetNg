import { Navigate } from "react-router";
import { Skeleton } from "../components";
import { useAsync } from "../hooks/useAsync";
import { reads } from "../lib/reads";
import { UpcomingScreen } from "./UpcomingScreen";

export function LiveIndexScreen(): React.JSX.Element {
  const live = useAsync(
    () => reads.listMatches({ phases: ["LIVE", "HALFTIME"], limit: 1 }),
    [],
    3000,
  );

  if (live.data === undefined) return <Skeleton className="h-full" />;

  const first = live.data[0];

  if (first !== undefined) return <Navigate to={`/live/${first.id}`} replace />;

  return <UpcomingScreen />;
}
