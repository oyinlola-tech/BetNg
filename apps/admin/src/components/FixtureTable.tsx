import { useNavigate } from "react-router";
import type { AdminFixture } from "@betng/contracts";
import { formatKickoffTime } from "@betng/ui-core";
import { DataTable, type Column } from "@betng/ui-web";
import { Status } from "./Bits";

export function FixtureTable({ rows, loading, error, onRetry, showLeague = true, pageSize = 20 }: { readonly rows: readonly AdminFixture[] | undefined; readonly loading: boolean; readonly error: unknown; readonly onRetry: () => void; readonly showLeague?: boolean; readonly pageSize?: number }): React.JSX.Element {
  const navigate = useNavigate();
  const columns: readonly Column<AdminFixture>[] = [
    ...(showLeague ? [{ key: "league", header: "Competition", sortValue: (f: AdminFixture) => f.leagueName, cell: (f: AdminFixture) => <span className="whitespace-nowrap text-text-secondary">{f.leagueName}</span> }] : []),
    { key: "md", header: "MD", numeric: true, align: "left", sortValue: (f) => f.matchday, cell: (f) => f.matchday, width: "56px" },
    { key: "home", header: "Home", sortValue: (f) => f.homeName, cell: (f) => <span className="whitespace-nowrap font-medium">{f.homeName}</span> },
    {
      key: "score",
      header: "",
      align: "center",
      width: "64px",
      cell: (f) => (f.matchStatus === "IN_PLAY" || f.matchStatus === "COMPLETED" ? <span className="font-display font-semibold tabular">{f.score.home}–{f.score.away}</span> : <span className="text-text-muted">v</span>),
    },
    { key: "away", header: "Away", sortValue: (f) => f.awayName, cell: (f) => <span className="whitespace-nowrap font-medium">{f.awayName}</span> },
    { key: "kickoff", header: "Scheduled", numeric: true, align: "left", sortValue: (f) => f.kickoffAt, cell: (f) => formatKickoffTime(f.kickoffAt) },
    { key: "betting", header: "Betting", sortValue: (f) => f.bettingStatus, cell: (f) => <Status value={f.bettingStatus} /> },
    { key: "match", header: "Match", sortValue: (f) => f.matchStatus, cell: (f) => <Status value={f.matchStatus} /> },
    { key: "simulation", header: "Simulation", sortValue: (f) => f.simulationStatus, cell: (f) => <Status value={f.simulationStatus} />, hideBelow: "lg" },
    { key: "settlement", header: "Settlement", sortValue: (f) => f.settlementStatus, cell: (f) => <Status value={f.settlementStatus} />, hideBelow: "lg" },
  ];

  return (
    <DataTable
      caption="Fixtures"
      columns={columns}
      rows={rows}
      rowKey={(f) => f.matchId}
      loading={loading}
      error={error}
      onRetry={onRetry}
      onRowClick={(f) => void navigate(`/matches/${f.matchId}`)}
      pageSize={pageSize}
      empty={{ title: "No fixtures match", description: "Change the competition, matchday or status filter." }}
    />
  );
}
