import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { AuditLogEntry, AuditLogQuery, AuditSeverity } from "@betng/contracts";
import { formatDateTime, localDayRange } from "@betng/ui-core";
import { Badge, Button, DataTable, Drawer, Input, Panel, Select, emptyPresets, useDebouncedValue, type Column } from "@betng/ui-web";
import { CopyButton, DetailItem, Mono, Stamp, Unavailable } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useAuditLog } from "../hooks/queries";
import { DASH, formatCount, humanise } from "../lib/format";

const SEVERITIES: readonly AuditSeverity[] = ["INFO", "NOTICE", "WARNING", "CRITICAL"];
const SEVERITY_TONE = { INFO: "neutral", NOTICE: "brand", WARNING: "warning", CRITICAL: "danger" } as const;
const TEXT_FILTERS = ["actor", "action", "resource"] as const;
const PAGE_SIZE = 25;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type TextFilter = (typeof TEXT_FILTERS)[number];

function show(value: unknown): string {
  if (value === "[REDACTED]") return "••••••••";

  return typeof value === "string" ? value : JSON.stringify(value);
}

function Diff({ before, after }: { readonly before: unknown; readonly after: unknown }): React.JSX.Element {
  const b = (typeof before === "object" && before !== null ? before : {}) as Record<string, unknown>;
  const a = (typeof after === "object" && after !== null ? after : {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(b), ...Object.keys(a)])];

  if (fields.length === 0) return <p className="text-sm text-text-muted">The platform recorded no state change for this action.</p>;

  return (
    <div className="overflow-x-auto rounded-sm border border-border scrollbar-thin">
      <table className="w-full text-left font-mono text-[12px]">
        <caption className="sr-only">Values before and after the action</caption>
        <thead>
          <tr className="border-b border-border bg-surface-sunken text-text-muted">
            <th scope="col" className="px-2.5 py-1.5 font-medium">field</th>
            <th scope="col" className="px-2.5 py-1.5 font-medium">before</th>
            <th scope="col" className="px-2.5 py-1.5 font-medium">after</th>
            <th scope="col" className="px-2.5 py-1.5 font-medium">change</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const changed = JSON.stringify(b[field]) !== JSON.stringify(a[field]);

            return (
              <tr key={field} className="border-b border-border align-top last:border-b-0">
                <th scope="row" className="px-2.5 py-1.5 font-medium text-text-secondary">{field}</th>
                <td className="break-all px-2.5 py-1.5 text-text-secondary">{field in b ? show(b[field]) : <span className="text-text-muted">not set</span>}</td>
                <td className="break-all px-2.5 py-1.5 text-text-primary">{field in a ? show(a[field]) : <span className="text-text-muted">not set</span>}</td>
                <td className="px-2.5 py-1.5 text-text-secondary">{!changed ? "same" : !(field in b) ? "added" : !(field in a) ? "removed" : "changed"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const COLUMNS: readonly Column<AuditLogEntry>[] = [
  { key: "timestamp", header: "Timestamp", hideable: false, cell: (e) => <Stamp iso={e.timestamp} /> },
  { key: "actor", header: "Actor", cell: (e) => <span className="block min-w-28 truncate font-medium">{e.actorName}</span> },
  { key: "role", header: "Role", cell: (e) => <span className="whitespace-nowrap text-sm text-text-secondary">{e.role === undefined ? DASH : humanise(e.role)}</span>, hideBelow: "lg" },
  { key: "action", header: "Action", cell: (e) => <Mono className="text-text-primary">{e.action}</Mono> },
  { key: "resource", header: "Resource", cell: (e) => <span className="text-text-secondary">{e.resource}</span>, hideBelow: "lg" },
  { key: "resourceId", header: "Resource ID", cell: (e) => <Mono>{e.resourceId === undefined ? DASH : e.resourceId.slice(0, 13)}</Mono>, hideBelow: "xl" },
  { key: "result", header: "Result", cell: () => <Unavailable what="The action's result" />, defaultHidden: true },
  { key: "severity", header: "Severity", cell: (e) => (e.severity === undefined ? <span className="text-text-muted">{DASH}</span> : <Badge tone={SEVERITY_TONE[e.severity]}>{humanise(e.severity)}</Badge>) },
  { key: "requestId", header: "Request ID", cell: (e) => <Mono>{e.requestId.slice(0, 14)}</Mono>, hideBelow: "xl" },
  { key: "ip", header: "IP", cell: (e) => <Mono>{e.ip ?? DASH}</Mono>, hideBelow: "xl" },
];

export function AuditPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<AuditLogEntry | undefined>();

  const applied = { actor: params.get("actor") ?? "", action: params.get("action") ?? "", resource: params.get("resource") ?? "" };
  const severity = SEVERITIES.find((s) => s === params.get("severity"));
  const from = DAY.test(params.get("from") ?? "") ? (params.get("from") ?? "") : "";
  const to = DAY.test(params.get("to") ?? "") ? (params.get("to") ?? "") : "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const [text, setText] = useState(applied);
  const debounced = useDebouncedValue(text, 300);
  const written = useRef(applied);

  const patch = (changes: Readonly<Record<string, string | undefined>>, resetPage = true): void => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        if (resetPage) next.delete("page");

        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === "") next.delete(key);
          else next.set(key, value);
        }

        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    const changes: Record<string, string> = {};

    for (const key of TEXT_FILTERS) {
      const value = debounced[key].trim();

      if (value !== written.current[key]) changes[key] = value;
    }

    if (Object.keys(changes).length === 0) return;

    written.current = { ...written.current, ...changes };
    patch(changes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const query: AuditLogQuery = {
    page,
    pageSize: PAGE_SIZE,
    ...(applied.actor === "" ? {} : { actor: applied.actor }),
    ...(applied.action === "" ? {} : { action: applied.action }),
    ...(applied.resource === "" ? {} : { resource: applied.resource }),
    ...(severity === undefined ? {} : { severity }),
    ...(from === "" ? {} : { from: localDayRange(from).from }),
    ...(to === "" ? {} : { to: localDayRange(to).to }),
  };
  const audit = useAuditLog(query);
  const filtered = TEXT_FILTERS.some((key) => applied[key] !== "") || severity !== undefined || from !== "" || to !== "";

  const textInput = (key: TextFilter, label: string, placeholder: string, width: string): React.JSX.Element => (
    <Input aria-label={label} placeholder={placeholder} value={text[key]} onChange={(event) => setText((current) => ({ ...current, [key]: event.target.value }))} className={`${width} [&>div]:h-8`} />
  );

  return (
    <>
      <PageHeader title="Audit logs" description="Every operator and system action, newest first. Secrets are redacted by the platform before they reach this screen. Filters are part of the address, so a view can be shared." />
      <Panel flush>
        <DataTable
          caption="Audit log"
          columns={COLUMNS}
          rows={audit.data?.items}
          rowKey={(e) => e.id}
          loading={audit.isPending}
          error={audit.error}
          onRetry={() => void audit.refetch()}
          onRowClick={setSelected}
          selectedKey={selected?.id}
          columnVisibility
          skeletonRows={10}
          pagination={{ page: audit.data?.page ?? page, pageSize: audit.data?.pageSize ?? PAGE_SIZE, total: audit.data?.total ?? 0, onPage: (next) => patch({ page: next <= 1 ? undefined : String(next) }, false) }}
          empty={{
            title: emptyPresets.noAdminRecords.title,
            description: filtered ? emptyPresets.noAdminRecords.description : "The platform has recorded no actions yet.",
          }}
          toolbar={
            <>
              {textInput("actor", "Filter by actor", "Actor", "w-32")}
              {textInput("action", "Filter by action", "Action", "w-40")}
              {textInput("resource", "Filter by resource or resource ID", "Resource or ID", "w-40")}
              <Select label="Severity" size="sm" value={severity ?? "all"} onChange={(value) => patch({ severity: value === "all" ? undefined : value })} options={[{ value: "all", label: "All severities" }, ...SEVERITIES.map((s) => ({ value: s, label: humanise(s) }))]} />
              <Input aria-label="From date" type="date" value={from} {...(to === "" ? {} : { max: to })} onChange={(event) => patch({ from: event.target.value })} className="w-36 [&>div]:h-8" />
              <Input aria-label="To date" type="date" value={to} {...(from === "" ? {} : { min: from })} onChange={(event) => patch({ to: event.target.value })} className="w-36 [&>div]:h-8" />
              {filtered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    written.current = { actor: "", action: "", resource: "" };
                    setText(written.current);
                    setParams({}, { replace: true });
                  }}
                >
                  Clear
                </Button>
              )}
              <span role="status" className="ml-auto text-sm tabular text-text-muted">
                {audit.data === undefined ? "" : `${formatCount(audit.data.total)} entries`}
              </span>
            </>
          }
          renderCard={(e) => (
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-3">
                <Mono className="text-text-primary">{e.action}</Mono>
                {e.severity !== undefined && <Badge tone={SEVERITY_TONE[e.severity]}>{humanise(e.severity)}</Badge>}
              </div>
              <p className="text-sm text-text-secondary">
                {e.actorName} · {e.resource}
              </p>
              <p className="text-sm tabular text-text-muted">{formatDateTime(e.timestamp)}</p>
            </div>
          )}
        />
      </Panel>

      <Drawer open={selected !== undefined} onClose={() => setSelected(undefined)} size="lg" title={selected?.action ?? ""} description={selected === undefined ? "" : formatDateTime(selected.timestamp)}>
        {selected !== undefined && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <DetailItem label="Actor">{selected.actorName}</DetailItem>
              <DetailItem label="Role">{selected.role === undefined ? DASH : humanise(selected.role)}</DetailItem>
              <DetailItem label="Resource">{selected.resource}</DetailItem>
              <DetailItem label="Severity">{selected.severity === undefined ? DASH : <Badge tone={SEVERITY_TONE[selected.severity]}>{humanise(selected.severity)}</Badge>}</DetailItem>
              <DetailItem label="Result">
                <Unavailable what="The action's result" />
              </DetailItem>
              <DetailItem label="Device">
                <Unavailable what="The device" />
              </DetailItem>
              <DetailItem label="Resource ID" className="col-span-2">
                <span className="flex items-center gap-1">
                  <Mono className="whitespace-normal break-all">{selected.resourceId ?? DASH}</Mono>
                  {selected.resourceId !== undefined && <CopyButton value={selected.resourceId} label="Copy resource ID" />}
                </span>
              </DetailItem>
              <DetailItem label="Request ID" className="col-span-2">
                <span className="flex items-center gap-1">
                  <Mono className="whitespace-normal break-all text-text-primary">{selected.requestId}</Mono>
                  <CopyButton value={selected.requestId} label="Copy request ID" />
                </span>
              </DetailItem>
              <DetailItem label="IP address">
                <Mono>{selected.ip ?? DASH}</Mono>
              </DetailItem>
              <DetailItem label="Actor ID">
                <Mono className="whitespace-normal break-all">{selected.actor}</Mono>
              </DetailItem>
            </dl>
            <section aria-labelledby="audit-change">
              <h3 id="audit-change" className="type-section mb-2">
                Before and after
              </h3>
              <Diff before={selected.before} after={selected.after} />
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}
