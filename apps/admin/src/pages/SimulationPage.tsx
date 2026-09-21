import { useMemo, useState } from "react";
import { Link } from "react-router";
import { RotateCcw, Undo2 } from "lucide-react";
import type { AdminSimulationRun, SimulationAdminAction } from "@betng/contracts";
import { DataTable, Panel, Tabs, type Column } from "@betng/ui-web";
import { Mono, Status } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction, useSimulations } from "../hooks/queries";
import { formatClockTime } from "../lib/format";
import { adminSource } from "../services/sources";

type Tab = "CURRENT" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

const IN_TAB: Readonly<Record<Tab, (run: AdminSimulationRun) => boolean>> = {
  CURRENT: (r) => r.status === "READY" || r.status === "RUNNING" || r.status === "FAILED",
  QUEUED: (r) => r.status === "QUEUED" || r.status === "READY",
  RUNNING: (r) => r.status === "RUNNING",
  COMPLETED: (r) => r.status === "COMPLETED",
  FAILED: (r) => r.status === "FAILED",
};

export function SimulationPage(): React.JSX.Element {
  const simulations = useSimulations();
  const [tab, setTab] = useState<Tab>("CURRENT");
  const { ask, dialog } = useReasonAction();
  const act = useAdminAction({
    run: (input: { readonly id: string; readonly action: SimulationAdminAction; readonly reason: string }) => adminSource.simulationAction(input.id, input.action, input.reason),
    success: (run, input) => `${run.id} ${input.action === "RETRY" ? "re-queued" : "returned to the queue"}`,
  });
  const count = (t: Tab): number => simulations.data?.filter(IN_TAB[t]).length ?? 0;
  const rows = useMemo(() => {
    const list = simulations.data?.filter(IN_TAB[tab]);

    return tab === "COMPLETED" ? list?.slice().reverse() : list;
  }, [simulations.data, tab]);

  const columns: readonly Column<AdminSimulationRun>[] = [
    { key: "id", header: "Simulation ID", cell: (r) => <Mono className="text-text-primary">{r.id}</Mono> },
    {
      key: "match",
      header: "Match",
      sortValue: (r) => r.matchLabel,
      cell: (r) => (
        <Link to={`/matches/${r.matchId}`} className="block min-w-44 rounded-xs hover:underline focus-ring">
          <span className="block truncate font-medium">{r.matchLabel}</span>
          <span className="block truncate text-sm text-text-muted">{r.leagueName}</span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      cell: (r) => (
        <span>
          <Status value={r.status} quiet />
          {r.error !== undefined && <span className="mt-0.5 block max-w-64 text-sm text-danger">{r.error}</span>}
        </span>
      ),
    },
    { key: "events", header: "Events", numeric: true, sortValue: (r) => r.events, cell: (r) => r.events },
    { key: "score", header: "Current score", align: "center", cell: (r) => (r.startedAt === undefined ? <span className="text-text-muted">—</span> : <span className="font-display font-semibold tabular">{r.score.home}–{r.score.away}</span>) },
    { key: "started", header: "Started", numeric: true, align: "left", sortValue: (r) => r.startedAt ?? "", cell: (r) => (r.startedAt === undefined ? <span className="text-text-muted">—</span> : formatClockTime(r.startedAt)), hideBelow: "md" },
    { key: "finished", header: "Finished", numeric: true, align: "left", sortValue: (r) => r.completedAt ?? "", cell: (r) => (r.completedAt === undefined ? <span className="text-text-muted">—</span> : formatClockTime(r.completedAt)), hideBelow: "md" },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) =>
        r.status === "FAILED" ? (
          <GuardedButton permission="simulation:operate" size="sm" variant="secondary" icon={<RotateCcw className="size-3.5" />} onClick={() => ask({ title: `Retry ${r.id}?`, description: `${r.matchLabel}. The run is queued again with the same inputs; the simulation service draws the result.`, confirmLabel: "Retry run", run: (reason) => act.mutateAsync({ id: r.id, action: "RETRY", reason }) })}>
            Retry
          </GuardedButton>
        ) : r.status === "READY" ? (
          <GuardedButton permission="simulation:operate" size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => ask({ title: `Return ${r.id} to the queue?`, description: `${r.matchLabel}. The prepared run is discarded and the scheduler prepares it again before kick-off.`, confirmLabel: "Return to queue", tone: "danger", run: (reason) => act.mutateAsync({ id: r.id, action: "CANCEL", reason }) })}>
            Cancel
          </GuardedButton>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Simulation" description="Runs the simulation service has queued, prepared, is playing out or has finished. Operators can retry a failed run or return a prepared one to the queue; nobody can write a result." />
      <Tabs<Tab>
        label="Simulation runs"
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "CURRENT", label: "Current", count: count("CURRENT") },
          { value: "QUEUED", label: "Queued", count: count("QUEUED") },
          { value: "RUNNING", label: "Running", count: count("RUNNING") },
          { value: "COMPLETED", label: "Completed", count: count("COMPLETED") },
          { value: "FAILED", label: "Failed", count: count("FAILED") },
        ]}
      />
      <Panel flush>
        <DataTable caption="Simulation runs" columns={columns} rows={rows} rowKey={(r) => r.id} loading={simulations.isLoading} error={simulations.error} onRetry={() => void simulations.refetch()} pageSize={15} empty={{ title: tab === "FAILED" ? "No failed runs" : "No runs here", description: tab === "FAILED" ? "Every run in the operating window prepared cleanly." : "Runs appear as matchdays enter the operating window." }} />
      </Panel>
      {dialog}
    </>
  );
}
