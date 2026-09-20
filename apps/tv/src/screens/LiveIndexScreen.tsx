import { Navigate } from "react-router";
import { Skeleton } from "../components";
import { useAsync } from "../hooks/useAsync";
import { dataSource } from "../services/dataSource";
import { UpcomingScreen } from "./UpcomingScreen";

export function LiveIndexScreen(): React.JSX.Element {
  const live = useAsync(
    () => dataSource.listMatches({ phases: ["LIVE", "HALFTIME"], limit: 1 }),
    [],
    3000,
  );

  if (live.data === undefined) return <Skeleton className="h-full" />;

  const first = live.data[0];

  if (first !== undefined) return <Navigate to={`/live/${first.id}`} replace />;

  return <UpcomingScreen />;
}
