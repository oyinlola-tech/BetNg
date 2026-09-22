import { unwrapStatusError } from "../httpError/index.js";
import type { HttpMiddleware, HttpRouter } from "@zudojs/http";

const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

export const METRICS_PATH = "/metrics";

export const METRICS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

interface Series {
  readonly labels: string;
  count: number;
  sum: number;
  readonly buckets: number[];
}

export interface MetricsRegistry {
  readonly observe: (method: string, route: string, status: number, seconds: number) => void;
  readonly render: () => string;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function createMetricsRegistry(service: string): MetricsRegistry {
  const series = new Map<string, Series>();
  const serviceLabel = `service="${escapeLabel(service)}"`;

  return {
    observe: (method, route, status, seconds) => {
      const labels = `${serviceLabel},method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${String(status)}"`;
      let entry = series.get(labels);

      if (entry === undefined) {
        entry = { labels, count: 0, sum: 0, buckets: BUCKETS.map(() => 0) };
        series.set(labels, entry);
      }

      entry.count += 1;
      entry.sum += seconds;

      BUCKETS.forEach((bound, index) => {
        if (seconds <= bound && entry !== undefined) entry.buckets[index] = (entry.buckets[index] ?? 0) + 1;
      });
    },

    render: () => {
      const lines: string[] = [
        "# HELP http_requests_total HTTP requests served, by route template and status.",
        "# TYPE http_requests_total counter",
      ];

      for (const entry of series.values()) {
        lines.push(`http_requests_total{${entry.labels}} ${String(entry.count)}`);
      }

      lines.push(
        "# HELP http_request_duration_seconds HTTP request latency, by route template and status.",
        "# TYPE http_request_duration_seconds histogram",
      );

      for (const entry of series.values()) {
        BUCKETS.forEach((bound, index) => {
          lines.push(`http_request_duration_seconds_bucket{${entry.labels},le="${String(bound)}"} ${String(entry.buckets[index] ?? 0)}`);
        });
        lines.push(
          `http_request_duration_seconds_bucket{${entry.labels},le="+Inf"} ${String(entry.count)}`,
          `http_request_duration_seconds_sum{${entry.labels}} ${String(entry.sum)}`,
          `http_request_duration_seconds_count{${entry.labels}} ${String(entry.count)}`,
        );
      }

      const cpu = process.cpuUsage();
      const memory = process.memoryUsage();
      const startSeconds = Math.round((Date.now() - process.uptime() * 1000) / 1000);

      lines.push(
        "# HELP process_cpu_seconds_total User and system CPU time spent.",
        "# TYPE process_cpu_seconds_total counter",
        `process_cpu_seconds_total{${serviceLabel}} ${String((cpu.user + cpu.system) / 1e6)}`,
        "# HELP process_resident_memory_bytes Resident memory size.",
        "# TYPE process_resident_memory_bytes gauge",
        `process_resident_memory_bytes{${serviceLabel}} ${String(memory.rss)}`,
        "# HELP nodejs_heap_used_bytes V8 heap in use.",
        "# TYPE nodejs_heap_used_bytes gauge",
        `nodejs_heap_used_bytes{${serviceLabel}} ${String(memory.heapUsed)}`,
        "# HELP nodejs_heap_total_bytes V8 heap allocated.",
        "# TYPE nodejs_heap_total_bytes gauge",
        `nodejs_heap_total_bytes{${serviceLabel}} ${String(memory.heapTotal)}`,
        "# HELP process_start_time_seconds Process start time since the Unix epoch.",
        "# TYPE process_start_time_seconds gauge",
        `process_start_time_seconds{${serviceLabel}} ${String(startSeconds)}`,
      );

      return `${lines.join("\n")}\n`;
    },
  };
}

// The route label is the matched template, never the raw path, so ids cannot explode the series count.
export function createMetricsMiddleware(registry: MetricsRegistry, router: HttpRouter): HttpMiddleware {
  return async (context, next) => {
    const { request } = context;
    const startedAt = performance.now();
    const route = router.match(request.method, request.path).route?.path ?? "unmatched";
    const record = (status: number): void => {
      registry.observe(request.method, route, status, (performance.now() - startedAt) / 1000);
    };

    try {
      const response = await next();

      record(response.status);

      return response;
    } catch (error) {
      record(unwrapStatusError(error)?.statusCode ?? 500);
      throw error;
    }
  };
}
