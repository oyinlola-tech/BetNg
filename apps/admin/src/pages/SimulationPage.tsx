import { useState } from "react";
import { Link } from "react-router";
import { RotateCcw, Undo2 } from "lucide-react";
import type { AdminSimulationRun, SimulationAdminAction } from "@betng/contracts";
import { Drawer, Panel, type Column } from "@betng/ui-web";
import { AdminListTable } from "../components/AdminListTable";
import { CopyButton, DetailItem, Mono, Stamp, Status, Unavailable } from "../components/Bits";
import { GuardedButton } from "../components/Guard";
import { PageHeader } from "../components/PageHeader";
import { useReasonAction } from "../components/ReasonAction";
import { useAdminAction } from "../hooks/queries";
import { useAdminList } from "../hooks/useAdminList";
import { formatCount, formatStamp } from "../lib/format";
import { adminSource } from "../services/runtime";

/* Read-only: the result is whatever the simulation service recorded, and it is withheld until the match is completed. */
function Result({ run }: { readonly run: AdminSimulationRun }): React.JSX.Element {
  return run.status !== "COMPLETED" || run.score === null ? (
    <span className="text-sm text-text-muted">Withheld</span>
  ) : (
    <span className="font-display font-semibold tabular">
      {run.score.home}–{run.score.away}
    </span>
  );
}

/* With the source code a seed is a result, so it is shown on the same terms as one. */
const seedOf = (run: AdminSimulationRun): string | undefined => (run.status === "COMPLETED" && run.seed !== null ? run.seed : undefined);

const shortId = (id: string): string => (id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

export function SimulationPage(): React.JSX.Element {
  const list = useAdminList("simulations", { defaults: { sort: "startedAt", direction: "desc" }, filterKeys: ["status"], refetchInterval: 15_000 });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = list.query.data?.items.find((run) => run.id === selectedId);
  const { ask, dialog } = useReasonAction();
  const act = useAdminAction({
    run: (input: { readonly id: string; readonly action: SimulationAdminAction; readonly reason: string }) => adminSource.simulationAction(input.id, input.action, input.reason),
    success: (_, input) => (input.action === "RETRY" ? "Run queued again" : "Run returned to the queue"),
  });

  const actions = (run: AdminSimulationRun): React.ReactNode =>
    run.status === "FAILED" ? (
      <GuardedButton
        permission="simulation:operate"
        size="sm"
        variant="secondary"
        leadingIcon={<RotateCcw className="size-3.5" aria-hidden />}
        onClick={() => ask({ title: "Retry this run?", description: `${run.matchLabel}. The failed run is queued again with the same inputs; the simulation service draws the result. A recorded result can never be re-run.`, confirmLabel: "Retry run", run: (reason) => act.mutateAsync({ id: run.id, action: "RETRY", reason }) })}
      >
        Retry
      </GuardedButton>
    ) : run.status === "READY" ? (
      <GuardedButton
        permission="simulation:operate"
        size="sm"
        variant="ghost"
        leadingIcon={<Undo2 className="size-3.5" aria-hidden />}
        onClick={() => ask({ title: "Cancel this prepared run?", description: `${run.matchLabel}. The prepared run is discarded and the scheduler prepares it again before kick-off.`, confirmLabel: "Cancel run", tone: "danger", run: (reason) => act.mutateAsync({ id: run.id, action: "CANCEL", reason }) })}
      >
        Cancel
      </GuardedButton>
    ) : null;

  const columns: readonly Column<AdminSimulationRun>[] = [
    { key: "id", header: "Simulation ID", sortable: true, hideable: false, cell: (r) => <Mono className="text-text-primary">{shortId(r.id)}</Mono> },
    {
      key: "matchLabel",
      header: "Match",
      sortable: true,
      cell: (r) => (
        <Link to={`/matches/${r.matchId}`} onClick={(event) => event.stopPropagation()} className="block min-w-44 rounded-xs hover:underline focus-ring">
          <span className="block truncate font-medium">{r.matchLabel}</span>
          <span className="block truncate text-sm text-text-muted">{r.leagueName}</span>
        </Link>
      ),
    },
    { key: "matchId", header: "Match ID", cell: (r) => <Mono>{shortId(r.matchId)}</Mono>, hideBelow: "xl" },
    { key: "status", header: "Status", sortable: true, cell: (r) => <Status value={r.status} /> },
    { key: "seed", header: "Seed", cell: (r) => (seedOf(r) === undefined ? <span className="text-sm text-text-muted">Withheld</span> : <Mono>{shortId(seedOf(r) ?? "")}</Mono>), hideBelow: "xl" },
    { key: "modelVersion", header: "Model", cell: () => <Unavailable what="The model version" />, defaultHidden: true },
    { key: "configurationVersion", header: "Config", cell: () => <Unavailable what="The configuration version" />, defaultHidden: true },
    { key: "startedAt", header: "Started", sortable: true, cell: (r) => <Stamp iso={r.startedAt} />, hideBelow: "lg" },
    { key: "completedAt", header: "Completed", sortable: true, cell: (r) => <Stamp iso={r.completedAt} />, hideBelow: "lg" },
    { key: "score", header: "Result", align: "center", cell: (r) => <Result run={r} /> },
    { key: "events", header: "Events", numeric: true, sortable: true, cell: (r) => formatCount(r.events) },
    { key: "settlementStatus", header: "Settlement", cell: () => <Unavailable what="The settlement status of a run" />, defaultHidden: true },
  ];

  return (
    <>
      <PageHeader title="Simulation" description="Runs the simulation service has queued, prepared, is playing out or has finished. Results are read-only here: operators can retry a failed run or cancel a prepared one, nothing more." />
      <Panel flush>
        <AdminListTable
          list={list}
          caption="Simulation runs"
          noun="runs"
          columns={columns}
          rowKey={(r) => r.id}
          search={{ label: "Search runs by match or id", placeholder: "Search match or id" }}
          filters={[
            {
              key: "status",
              label: "Run status",
              anyLabel: "All run states",
              options: [
                { value: "QUEUED", label: "Queued" },
                { value: "READY", label: "Ready" },
                { value: "RUNNING", label: "Running" },
                { value: "COMPLETED", label: "Completed" },
                { value: "FAILED", label: "Failed" },
              ],
            },
          ]}
          onRowClick={(r) => setSelectedId(r.id)}
          selectedKey={selectedId}
          rowActions={actions}
          renderCard={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.matchLabel}</span>
                  <Mono>{shortId(r.id)}</Mono>
                </span>
                <Status value={r.status} />
              </div>
              <div className="flex items-baseline justify-between text-sm text-text-secondary">
                <span>{formatCount(r.events)} events</span>
                <Result run={r} />
              </div>
            </div>
          )}
        />
      </Panel>

      <Drawer open={selected !== undefined} onClose={() => setSelectedId(undefined)} title="Simulation run" description={selected?.matchLabel ?? ""} footer={selected === undefined ? undefined : actions(selected)}>
        {selected !== undefined && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailItem label="Simulation ID" className="col-span-2">
              <span className="flex items-center gap-1">
                <Mono className="whitespace-normal break-all text-text-primary">{selected.id}</Mono>
                <CopyButton value={selected.id} label="Copy simulation ID" />
              </span>
            </DetailItem>
            <DetailItem label="Match ID" className="col-span-2">
              <span className="flex items-center gap-1">
                <Mono className="whitespace-normal break-all">{selected.matchId}</Mono>
                <CopyButton value={selected.matchId} label="Copy match ID" />
              </span>
            </DetailItem>
            <DetailItem label="Status">
              <Status value={selected.status} />
            </DetailItem>
            <DetailItem label="Result">
              <Result run={selected} />
            </DetailItem>
            <DetailItem label="Model version">
              <Unavailable what="The model version" />
            </DetailItem>
            <DetailItem label="Configuration version">
              <Unavailable what="The configuration version" />
            </DetailItem>
            <DetailItem label="Seed" className="col-span-2">
              {seedOf(selected) === undefined ? <span className="text-sm text-text-muted">Withheld until the match is completed</span> : <Mono className="whitespace-normal break-all">{seedOf(selected)}</Mono>}
            </DetailItem>
            <DetailItem label="Started at">{formatStamp(selected.startedAt)}</DetailItem>
            <DetailItem label="Completed at">{formatStamp(selected.completedAt)}</DetailItem>
            <DetailItem label="Events generated">{formatCount(selected.events)}</DetailItem>
            <DetailItem label="Event generation status">
              <Unavailable what="An event generation status" />
            </DetailItem>
            <DetailItem label="Settlement status">
              <Unavailable what="The settlement status of a run" />
            </DetailItem>
            {selected.error !== undefined && (
              <DetailItem label="Run error" className="col-span-2">
                <span className="text-sm text-text-secondary">{selected.error}</span>
              </DetailItem>
            )}
          </dl>
        )}
      </Drawer>
      {dialog}
    </>
  );
}
