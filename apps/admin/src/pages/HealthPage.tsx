import { RefreshCw } from "lucide-react";
import type { ServiceHealth } from "@betng/contracts";
import { formatAge } from "@betng/ui-core";
import { Button, EmptyState, ErrorState, Panel, StaleBadge, StatusBadge, TableSkeleton, cn, useNow } from "@betng/ui-web";
import { Mono, Unavailable } from "../components/Bits";
import { PageHeader } from "../components/PageHeader";
import { useServiceHealth } from "../hooks/queries";
import { useConnection } from "../hooks/useAdmin";
import { HEALTH } from "../lib/format";

const STALE_MS = 45_000;

const RULE: Readonly<Record<ServiceHealth["status"], string>> = { ok: "border-l-transparent", degraded: "border-l-warning", unavailable: "border-l-danger" };

const CONNECTION: Readonly<Record<string, { readonly status: string; readonly label: string }>> = {
  CONNECTED: { status: "HEALTHY", label: "Connected" },
  CONNECTING: { status: "PENDING", label: "Connecting" },
  RECONNECTING: { status: "DEGRADED", label: "Reconnecting" },
  OFFLINE: { status: "OFFLINE", label: "Offline" },
  FAILED: { status: "ERROR", label: "Unavailable" },
};

export function HealthPage(): React.JSX.Element {
  const health = useServiceHealth();
  const connection = useConnection();
  const now = useNow(1000);
  const services = health.data;
  const realtime = CONNECTION[connection] ?? { status: "PENDING", label: connection };

  return (
    <>
      <PageHeader
        title="System health"
        description="Service status as the platform reports it, refreshed every 15 seconds. Only what the platform sends is shown; there is no infrastructure detail on this screen."
        actions={
          <>
            {health.dataUpdatedAt > 0 && <span className="text-sm tabular text-text-muted">Checked {formatAge(new Date(health.dataUpdatedAt).toISOString(), now)}</span>}
            <Button variant="secondary" size="sm" loading={health.isFetching} leadingIcon={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => void health.refetch()}>
              Refresh
            </Button>
          </>
        }
      />
      <Panel flush>
        {services === undefined ? (
          health.error !== null ? (
            <ErrorState error={health.error} onRetry={() => void health.refetch()} />
          ) : (
            <TableSkeleton rows={9} columns={5} />
          )
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] text-left text-base">
              <caption className="sr-only">Service health</caption>
              <thead>
                <tr className="border-b border-border">
                  {["Service", "Status", "Latency", "Last checked", "Version"].map((heading) => (
                    <th key={heading} scope="col" className={cn("caps-label px-4 py-2", heading === "Latency" && "text-right")}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <th scope="row" className="border-l-2 border-l-transparent px-4 py-2.5 font-medium">
                    Realtime
                    <span className="block text-sm font-normal text-text-muted">This console's own connection</span>
                  </th>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={realtime.status}>{realtime.label}</StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Unavailable what="Latency" />
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">Live</td>
                  <td className="px-4 py-2.5">
                    <Unavailable what="The version" />
                  </td>
                </tr>
                {services.map((service) => {
                  const view = HEALTH[service.status];

                  return (
                    <tr key={service.service} className="border-b border-border last:border-b-0">
                      <th scope="row" className={cn("border-l-2 px-4 py-2.5 font-medium capitalize", RULE[service.status])}>
                        {service.service}
                      </th>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={view.status}>{view.label}</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{service.status === "unavailable" ? <span className="text-text-muted">no answer</span> : `${String(service.latencyMs)} ms`}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex flex-wrap items-center gap-2 tabular text-text-secondary">
                          {formatAge(service.checkedAt, now)}
                          <StaleBadge updatedAt={service.checkedAt} staleAfterMs={STALE_MS} />
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Mono>{service.version}</Mono>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {services.length === 0 && <EmptyState compact title="No services reported" description="The platform answered an empty service list." />}
            <p className="border-t border-border px-4 py-2 text-sm text-text-muted">Uptime is not provided by the platform, so it is not shown.</p>
          </div>
        )}
      </Panel>
    </>
  );
}
