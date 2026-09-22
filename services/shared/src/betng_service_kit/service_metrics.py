"""Service-specific Prometheus metrics for Python microservices.

Extends the base MetricsRegistry with domain counters, histograms, and gauges
that are meaningful for the BetNg Python services.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Final


class ServiceMetricsRegistry:
    """Domain-specific metrics beyond basic HTTP request tracking.

    Each service can register its own counters, histograms, and gauges.
    All metrics are thread-safe and rendered in Prometheus exposition format.
    """

    def __init__(self, service: str) -> None:
        self._service_label = f'service="{_escape(service)}"'
        self._counters: dict[str, dict[str, int]] = {}
        self._histograms: dict[str, _Histogram] = {}
        self._gauges: dict[str, float] = {}
        self._lock = threading.Lock()

    def increment_counter(
        self, name: str, labels: dict[str, str] | None = None, value: int = 1
    ) -> None:
        key = _label_key(labels)
        with self._lock:
            series = self._counters.setdefault(name, {})
            series[key] = series.get(key, 0) + value

    def observe_histogram(
        self, name: str, value: float, labels: dict[str, str] | None = None
    ) -> None:
        key = _label_key(labels)
        with self._lock:
            hist = self._histograms.setdefault(name, _Histogram())
            hist.observe(key, value)

    def set_gauge(self, name: str, value: float, labels: dict[str, str] | None = None) -> None:
        key = _label_key(labels)
        with self._lock:
            self._gauges[f"{name}:{key}"] = value

    def render(self) -> str:
        lines: list[str] = []
        label = self._service_label

        with self._lock:
            for name, series in self._counters.items():
                lines.append(f"# HELP betng_{name} Counter: {name}")
                lines.append(f"# TYPE betng_{name} counter")
                for key, count in series.items():
                    labels = f'{label},{key}' if key else label
                    lines.append(f"betng_{name}{{{labels}}} {count}")

            for name, hist in self._histograms.items():
                lines.append(f"# HELP betng_{name} Histogram: {name}")
                lines.append(f"# TYPE betng_{name} histogram")
                for key, bucket_data in hist.series.items():
                    labels = f'{label},{key}' if key else label
                    for le, count in bucket_data.buckets.items():
                        lines.append(
                            f"betng_{name}_bucket{{{labels},le=\"{le}\"}} {count}"
                        )
                    lines.append(
                        f"betng_{name}_bucket{{{labels},le=\"+Inf\"}} {bucket_data.total}"
                    )
                    lines.append(f"betng_{name}_sum{{{labels}}} {bucket_data.sum:.6f}")
                    lines.append(f"betng_{name}_count{{{labels}}} {bucket_data.total}")

            for full_key, value in self._gauges.items():
                name, key = full_key.rsplit(":", 1)
                labels = f'{label},{key}' if key else label
                lines.append(f"# HELP betng_{name} Gauge: {name}")
                lines.append(f"# TYPE betng_{name} gauge")
                lines.append(f"betng_{name}{{{labels}}} {value:.6f}")

        return "\n".join(lines) + "\n"


@dataclass
class _BucketData:
    buckets: dict[str, int] = field(default_factory=dict)
    total: int = 0
    sum: float = 0.0


class _Histogram:
    BUCKETS: Final[tuple[float, ...]] = (0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)

    def __init__(self) -> None:
        self.series: dict[str, _BucketData] = {}

    def observe(self, key: str, value: float) -> None:
        data = self.series.setdefault(key, _BucketData())
        data.total += 1
        data.sum += value
        for le in self.BUCKETS:
            bucket_le = str(le)
            if value <= le:
                data.buckets[bucket_le] = data.buckets.get(bucket_le, 0) + 1


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _label_key(labels: dict[str, str] | None) -> str:
    if not labels:
        return ""
    return ",".join(f'{k}="{_escape(v)}"' for k, v in sorted(labels.items()))


# Pre-configured metrics for common use cases

class OddsMetrics:
    """Metrics for the odds service."""

    def __init__(self, registry: ServiceMetricsRegistry) -> None:
        self._registry = registry

    def markets_published(self, match_id: str, count: int) -> None:
        self._registry.increment_counter(
            "odds_markets_published", {"match_id": match_id}, count
        )

    def odds_recalculated(self, match_id: str, event_type: str) -> None:
        self._registry.increment_counter(
            "odds_recalculations", {"match_id": match_id, "event": event_type}
        )

    def pricing_duration(self, seconds: float) -> None:
        self._registry.observe_histogram("odds_pricing_duration_seconds", seconds)


class SimulationMetrics:
    """Metrics for the simulation service."""

    def __init__(self, registry: ServiceMetricsRegistry) -> None:
        self._registry = registry

    def simulation_run(self, model_version: str, duration_seconds: float) -> None:
        self._registry.increment_counter(
            "simulation_runs", {"model": model_version}
        )
        self._registry.observe_histogram(
            "simulation_duration_seconds", duration_seconds, {"model": model_version}
        )

    def monte_carlo_simulations(self, count: int) -> None:
        self._registry.set_gauge("monte_carlo_simulations", float(count))

    def cache_hit(self) -> None:
        self._registry.increment_counter("probability_cache_hits")

    def cache_miss(self) -> None:
        self._registry.increment_counter("probability_cache_misses")


class RiskMetrics:
    """Metrics for the risk service."""

    def __init__(self, registry: ServiceMetricsRegistry) -> None:
        self._registry = registry

    def stake_evaluated(
        self, decision: str, reason: str, duration_seconds: float
    ) -> None:
        self._registry.increment_counter(
            "risk_stake_evaluations",
            {"decision": decision, "reason": reason},
        )
        self._registry.observe_histogram(
            "risk_evaluation_duration_seconds", duration_seconds
        )

    def exposure_alert(self, level: str, market_id: str) -> None:
        self._registry.increment_counter(
            "risk_exposure_alerts", {"level": level, "market_id": market_id}
        )

    def circuit_breaker_state(self, peer: str, state: str) -> None:
        self._registry.set_gauge(
            "circuit_breaker_state", 1.0, {"peer": peer, "state": state}
        )


class AnalyticsMetrics:
    """Metrics for the analytics service."""

    def __init__(self, registry: ServiceMetricsRegistry) -> None:
        self._registry = registry

    def query_duration(self, query_type: str, seconds: float) -> None:
        self._registry.observe_histogram(
            "analytics_query_duration_seconds", seconds, {"type": query_type}
        )

    def report_generated(self, report_type: str) -> None:
        self._registry.increment_counter(
            "analytics_reports_generated", {"type": report_type}
        )
