import { useNavigate } from "react-router";
import type { AdminFixture } from "@betng/contracts";
import { formatDateTime } from "@betng/ui-core";
import type { Column } from "@betng/ui-web";
import { useLeagues } from "../hooks/queries";
import { useAdminList, type AdminListDefaults } from "../hooks/useAdminList";
import { AdminListTable, type ListFilter } from "./AdminListTable";
import { Stamp, Status } from "./Bits";

const option = (value: string, label: string): { readonly value: string; readonly label: string } => ({ value, label });

const MATCH_STATUS: ListFilter = {
  key: "matchStatus",
  label: "Match status",
  anyLabel: "All match states",
  options: [option("SCHEDULED", "Scheduled"), option("BETTING_OPEN", "Betting open"), option("BETTING_CLOSED", "Betting closed"), option("IN_PLAY", "Live"), option("COMPLETED", "Completed"), option("CANCELLED", "Void")],
};

const BETTING_STATUS: ListFilter = {
  key: "bettingStatus",
  label: "Betting status",
  anyLabel: "All betting states",
  options: [option("NOT_OPEN", "Not open"), option("OPEN", "Open"), option("CLOSED", "Closed"), option("SUSPENDED", "Suspended")],
};

const SIMULATION_STATUS: ListFilter = {
  key: "simulationStatus",
  label: "Simulation status",
  anyLabel: "All simulation states",
  options: [option("QUEUED", "Queued"), option("READY", "Ready"), option("RUNNING", "Running"), option("COMPLETED", "Completed"), option("FAILED", "Failed")],
};

const SETTLEMENT_STATUS: ListFilter = {
  key: "settlementStatus",
  label: "Settlement status",
  anyLabel: "All settlement states",
  options: [option("NOT_DUE", "Not due"), option("PENDING", "Pending"), option("COMPLETED", "Completed"), option("FAILED", "Failed"), option("VOIDED", "Voided")],
};

/* The score is the platform's. It is shown only once the platform says the match is in play or over. */
function Score({ fixture }: { readonly fixture: AdminFixture }): React.JSX.Element {
  return fixture.matchStatus === "IN_PLAY" || fixture.matchStatus === "COMPLETED" ? (
    <span className="font-display font-semibold tabular">
      {fixture.score.home}–{fixture.score.away}
    </span>
  ) : (
    <span className="text-text-muted">v</span>
  );
}

export function FixtureList({ leagueId, defaults, pipelines = true }: { readonly leagueId?: string; readonly defaults?: AdminListDefaults; /** Show the simulation and settlement pipelines as filters and columns. */ readonly pipelines?: boolean }): React.JSX.Element {
  const navigate = useNavigate();
  const scoped = leagueId !== undefined;
  const leagues = useLeagues();
  const list = useAdminList("fixtures", {
    defaults: { sort: "kickoffAt", direction: "desc", ...defaults },
    filterKeys: [...(scoped ? [] : ["leagueId"]), "matchStatus", ...(pipelines ? ["simulationStatus", "settlementStatus"] : ["bettingStatus"])],
    ...(scoped ? { fixedFilters: { leagueId } } : {}),
    refetchInterval: 15_000,
  });

  const columns: readonly Column<AdminFixture>[] = [
    ...(scoped ? [] : [{ key: "leagueName", header: "Competition", sortable: true, cell: (f: AdminFixture) => <span className="whitespace-nowrap text-text-secondary">{f.leagueName}</span>, hideBelow: "xl" as const }]),
    { key: "matchday", header: "MD", numeric: true, align: "left", sortable: true, cell: (f) => f.matchday, width: "56px" },
    { key: "homeName", header: "Home", sortable: true, hideable: false, cell: (f) => <span className="whitespace-nowrap font-medium">{f.homeName}</span> },
    { key: "score", header: "Score", align: "center", width: "64px", cell: (f) => <Score fixture={f} /> },
    { key: "awayName", header: "Away", sortable: true, hideable: false, cell: (f) => <span className="whitespace-nowrap font-medium">{f.awayName}</span> },
    { key: "kickoffAt", header: "Kick-off", sortable: true, cell: (f) => <Stamp iso={f.kickoffAt} /> },
    { key: "bettingStatus", header: "Betting", sortable: true, cell: (f) => <Status value={f.bettingStatus} /> },
    { key: "matchStatus", header: "Match", sortable: true, cell: (f) => <Status value={f.matchStatus} /> },
    { key: "simulationStatus", header: "Simulation", sortable: true, cell: (f) => <Status value={f.simulationStatus} />, hideBelow: "xl", defaultHidden: !pipelines },
    { key: "settlementStatus", header: "Settlement", sortable: true, cell: (f) => <Status value={f.settlementStatus} />, hideBelow: "xl", defaultHidden: !pipelines },
  ];

  return (
    <AdminListTable
      list={list}
      caption="Fixtures"
      noun="fixtures"
      columns={columns}
      rowKey={(f) => f.matchId}
      search={{ label: "Search fixtures by team", placeholder: "Search team" }}
      filters={[...(scoped ? [] : [{ key: "leagueId", label: "Competition", anyLabel: "All competitions", options: (leagues.data ?? []).map((l) => option(l.id, l.name)) }]), MATCH_STATUS, ...(pipelines ? [SIMULATION_STATUS, SETTLEMENT_STATUS] : [BETTING_STATUS])]}
      onRowClick={(f) => void navigate(`/matches/${f.matchId}`)}
      renderCard={(f) => (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm text-text-muted">
            <span className="truncate">
              {f.leagueName} · MD {f.matchday}
            </span>
            <Status value={f.matchStatus} />
          </div>
          <div className="flex items-center justify-between gap-3 font-medium">
            <span className="min-w-0 truncate">
              {f.homeName} <span className="text-text-muted">v</span> {f.awayName}
            </span>
            <Score fixture={f} />
          </div>
          <p className="text-sm tabular text-text-secondary">{formatDateTime(f.kickoffAt)}</p>
        </div>
      )}
    />
  );
}
