import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { AuditLogEntry, AuditLogQuery, AuditSeverity } from "@betng/contracts";
import { formatDateTime } from "@betng/ui-core";
import { Badge, Button, DataTable, Drawer, Input, Panel, Select, type Column } from "@betng/ui-web";
import { CopyButton, Field, FilterBar, Mono } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useAuditLog } from "../hooks/queries";

const SEVERITY_TONE = { INFO: "neutral", NOTICE: "brand", WARNING: "warning", CRITICAL: "danger" } as const;
const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);

    return () => clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}

function show(value: unknown): string {
  if (value === "[REDACTED]") return "••••••••";

  return typeof value === "string" ? value : JSON.stringify(value);
}

function Diff({ before, after }: { readonly before: unknown; readonly after: unknown }): React.JSX.Element {
  const b = (typeof before === "object" && before !== null ? before : {}) as Record<string, unknown>;
  const a = (typeof after === "object" && after !== null ? after : {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];

  if (fields.length === 0) return <p className="text-sm text-text-muted">No state change was recorded for this action.</p>;

  return (
    <div className="overflow-x-auto rounded-sm border border-border scrollbar-thin">
      <table className="w-full text-left font-mono text-[12px]">
        <thead>
          <tr className="border-b border-border bg-surface-sunken text-text-muted">
            <th scope="col" className="px-2.5 py-1.5 font-medium">field</th>
            <th scope="col" className="px-2.5 py-1.5 font-medium">before</th>
            <th scope="col" className="px-2.5 py-1.5 font-medium">after</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const changed = JSON.stringify(b[field]) !== JSON.stringify(a[field]);

            return (
              <tr key={field} className="border-b border-border align-top last:border-b-0">
                <th scope="row" className="px-2.5 py-1.5 font-medium text-text-secondary">{field}</th>
                <td className="break-all px-2.5 py-1.5 text-text-secondary">{field in b ? <span className={changed ? "rounded-xs bg-danger-subtle px-1 text-danger" : undefined}>{show(b[field])}</span> : <span className="text-text-muted">∅</span>}</td>
                <td className="break-all px-2.5 py-1.5 text-text-primary">{field in a ? <span className={changed ? "rounded-xs bg-success-subtle px-1 text-success" : undefined}>{show(a[field])}</span> : <span className="text-text-muted">∅</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AuditPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState(params.get("resource") ?? "");
  const [severity, setSeverity] = useState<AuditSeverity | "ALL">("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogEntry | undefined>();
  const text = useDebounced(useMemo(() => ({ actor, action, resource }), [actor, action, resource]));

  const query: AuditLogQuery = {
    page,
    pageSize: PAGE_SIZE,
    ...(text.actor === "" ? {} : { actor: text.actor }),
    ...(text.action === "" ? {} : { action: text.action }),
    ...(text.resource === "" ? {} : { resource: text.resource }),
    ...(severity === "ALL" ? {} : { severity }),
    ...(from === "" ? {} : { from: new Date(`${from}T00:00:00`).toISOString() }),
    ...(to === "" ? {} : { to: new Date(`${to}T23:59:59`).toISOString() }),
  };
  const audit = useAuditLog(query);
  const filtered = actor !== "" || action !== "" || resource !== "" || severity !== "ALL" || from !== "" || to !== "";

  useEffect(() => {
    setPage(1);
  }, [text, severity, from, to]);

  const columns: readonly Column<AuditLogEntry>[] = [
    { key: "time", header: "Timestamp", numeric: true, align: "left", cell: (e) => formatDateTime(e.timestamp) },
    {
      key: "actor",
      header: "Actor",
      cell: (e) => (
        <span className="block min-w-32">
          <span className="block truncate font-medium">{e.actorName}</span>
          <span className="block text-[10px] font-semibold uppercase tracking-caps text-text-muted">{(e.role ?? "").replace("_", " ")}</span>
        </span>
      ),
    },
    { key: "action", header: "Action", cell: (e) => <Mono className="text-text-primary">{e.action}</Mono> },
    { key: "resource", header: "Resource", cell: (e) => <span className="text-text-secondary">{e.resource}</span>, hideBelow: "md" },
    { key: "resourceId", header: "Resource ID", cell: (e) => <Mono>{e.resourceId === undefined ? "—" : e.resourceId.slice(0, 13)}</Mono>, hideBelow: "lg" },
    { key: "severity", header: "Severity", cell: (e) => <Badge tone={SEVERITY_TONE[e.severity ?? "INFO"]}>{e.severity ?? "INFO"}</Badge> },
    { key: "request", header: "Request ID", cell: (e) => <Mono>{e.requestId.slice(0, 14)}</Mono>, hideBelow: "xl" },
    { key: "ip", header: "IP", cell: (e) => <Mono>{e.ip ?? "—"}</Mono>, hideBelow: "xl" },
  ];

  return (
    <>
      <PageHeader title="Audit logs" description="Every operator and system action, newest first. Secrets are redacted by the platform before they reach this screen." />
      <Panel flush>
        <FilterBar>
          <Input aria-label="Actor" placeholder="Actor" value={actor} onChange={(e) => setActor(e.target.value)} className="w-36 [&>div]:h-9" />
          <Input aria-label="Action" placeholder="Action, e.g. market.suspend" value={action} onChange={(e) => setAction(e.target.value)} className="w-52 [&>div]:h-9" />
          <Input aria-label="Resource or resource ID" placeholder="Resource or ID" value={resource} onChange={(e) => setResource(e.target.value)} className="w-44 [&>div]:h-9" />
          <Select
            label="Severity"
            size="sm"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: "ALL", label: "All severities" },
              { value: "INFO", label: "Info" },
              { value: "NOTICE", label: "Notice" },
              { value: "WARNING", label: "Warning" },
              { value: "CRITICAL", label: "Critical" },
            ]}
          />
          <Input aria-label="From date" type="date" value={from} max={to === "" ? undefined : to} onChange={(e) => setFrom(e.target.value)} className="w-36 [&>div]:h-9" />
          <Input aria-label="To date" type="date" value={to} min={from === "" ? undefined : from} onChange={(e) => setTo(e.target.value)} className="w-36 [&>div]:h-9" />
          {filtered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActor("");
                setAction("");
                setResource("");
                setSeverity("ALL");
                setFrom("");
                setTo("");
                setParams({}, { replace: true });
              }}
            >
              Clear filters
            </Button>
          )}
        </FilterBar>
        <DataTable
          caption="Audit log"
          columns={columns}
          rows={audit.data?.items}
          rowKey={(e) => e.id}
          loading={audit.isLoading}
          error={audit.error}
          onRetry={() => void audit.refetch()}
          onRowClick={setSelected}
          selectedKey={selected?.id}
          pagination={{ page, pageSize: PAGE_SIZE, total: audit.data?.total ?? 0, onPage: setPage }}
          empty={{ title: "No entries match", description: "Widen the date range or clear a filter." }}
        />
      </Panel>

      <Drawer open={selected !== undefined} onClose={() => setSelected(undefined)} size="lg" title={selected?.action ?? ""} description={selected === undefined ? "" : formatDateTime(selected.timestamp)}>
        {selected !== undefined && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Actor">{selected.actorName}</Field>
              <Field label="Role">{(selected.role ?? "—").replace("_", " ")}</Field>
              <Field label="Resource">{selected.resource}</Field>
              <Field label="Severity">
                <Badge tone={SEVERITY_TONE[selected.severity ?? "INFO"]}>{selected.severity ?? "INFO"}</Badge>
              </Field>
              <Field label="Resource ID" className="col-span-2">
                <span className="flex items-center gap-1">
                  <Mono className="break-all">{selected.resourceId ?? "—"}</Mono>
                  {selected.resourceId !== undefined && <CopyButton value={selected.resourceId} label="Copy resource ID" />}
                </span>
              </Field>
              <Field label="Request ID" className="col-span-2">
                <span className="flex items-center gap-1">
                  <Mono className="break-all text-text-primary">{selected.requestId}</Mono>
                  <CopyButton value={selected.requestId} label="Copy request ID" />
                </span>
              </Field>
              <Field label="IP address">
                <Mono>{selected.ip ?? "Not provided"}</Mono>
              </Field>
              <Field label="Actor ID">
                <Mono>{selected.actor.slice(0, 22)}</Mono>
              </Field>
            </dl>
            <section>
              <h3 className="caps-label mb-2">Change</h3>
              <Diff before={selected.before} after={selected.after} />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
