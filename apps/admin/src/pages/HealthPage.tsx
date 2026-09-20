import { useEffect, useRef, useState } from "react";
import type { ServiceHealth } from "@betng/contracts";
import { ErrorState, KpiCard, Panel, SkeletonRows, Sparkline, StatusBadge, cn, useNow } from "@betng/ui-web";
import { Mono } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useServiceHealth } from "../hooks/queries";
import { HEALTH } from "../lib/format";

const STALE_MS = 20_000;
const SAMPLES = 24;

function useLatencyHistory(services: readonly ServiceHealth[] | undefined, stamp: number): Readonly<Record<string, readonly number[]>> {
  const history = useRef<Record<string, number[]>>({});
  const [, force] = useState(0);

  useEffect(() => {
    if (services === undefined) return;

    for (const s of services) history.current[s.service] = [...(history.current[s.service] ?? []), s.latencyMs].slice(-SAMPLES);

    force((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  return history.current;
}

function heartbeat(checkedAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(checkedAt)) / 1000));

  return seconds < 2 ? "just now" : seconds < 90 ? `${String(seconds)}s ago` : `${String(Math.round(seconds / 60))} min ago`;
}

export function HealthPage(): React.JSX.Element {
  const health = useServiceHealth();
  const now = useNow(1000);
  const history = useLatencyHistory(health.data, health.dataUpdatedAt);
  const services = health.data;

  if (services === undefined) return health.error !== null ? <ErrorState error={health.error} onRetry={() => void health.refetch()} /> : <SkeletonRows rows={8} />;

  const count = (status: ServiceHealth["status"]): number => services.filter((s) => s.status === status).length;
  const worst = count("unavailable") > 0 ? "unavailable" : count("degraded") > 0 ? "degraded" : "ok";

  return (
    <>
      <PageHeader
        title="System health"
        description="Liveness, latency and last heartbeat for every platform service. Refreshes every five seconds."
        actions={<StatusBadge tone={HEALTH[worst].tone}>{worst === "ok" ? "All services healthy" : worst === "degraded" ? "Degraded performance" : "Service outage"}</StatusBadge>}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <KpiCard label="Healthy" value={String(count("ok"))} hint={`of ${String(services.length)} services`} />
        <KpiCard label="Degraded" value={String(count("degraded"))} hint="serving, but slow or partial" />
        <KpiCard label="Offline" value={String(count("unavailable"))} hint="no heartbeat" />
      </div>
      <Panel flush>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-left text-base">
            <caption className="sr-only">Service health</caption>
            <thead>
              <tr className="caps-label border-b border-border">
                <th scope="col" className="px-4 py-2 font-semibold">Service</th>
                <th scope="col" className="px-4 py-2 font-semibold">Health</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Latency</th>
                <th scope="col" className="px-4 py-2 font-semibold">Recent latency</th>
                <th scope="col" className="px-4 py-2 font-semibold">Last heartbeat</th>
                <th scope="col" className="px-4 py-2 font-semibold">Version</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const view = HEALTH[service.status];
                const stale = now - Date.parse(service.checkedAt) > STALE_MS;
                const samples = history[service.service] ?? [];

                return (
                  <tr key={service.service} className={cn("border-b border-border last:border-b-0", service.status === "unavailable" && "bg-danger-subtle", service.status === "degraded" && "bg-warning-subtle")}>
                    <th scope="row" className={cn("border-l-2 px-4 py-2.5 font-medium capitalize", service.status === "unavailable" ? "border-l-danger" : service.status === "degraded" ? "border-l-warning" : "border-l-transparent")}>
                      {service.service}
                    </th>
                    <td className="px-4 py-2.5">
                      <StatusBadge tone={view.tone}>{view.label}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{service.status === "unavailable" ? <span className="text-text-muted">—</span> : `${String(service.latencyMs)} ms`}</td>
                    <td className="px-4 py-2.5">{samples.length > 1 ? <Sparkline values={samples} width={96} height={22} /> : <span className="text-sm text-text-muted">collecting…</span>}</td>
                    <td className={cn("px-4 py-2.5 tabular", stale ? "font-medium text-warning" : "text-text-secondary")}>
                      {heartbeat(service.checkedAt, now)}
                      {stale && <span className="sr-only"> (stale)</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Mono>v{service.version}</Mono>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
