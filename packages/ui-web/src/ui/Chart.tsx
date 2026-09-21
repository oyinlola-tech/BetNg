import { useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { useElementWidth } from "../hooks/useElementWidth";

/** Series colours are assigned by position and never cycled; a fourth series belongs in a second chart. */
const SERIES = ["var(--bn-series1)", "var(--bn-series2)", "var(--bn-series3)"] as const;

export interface ChartSeries {
  readonly key: string;
  readonly label: string;
  readonly values: readonly number[];
}

interface BaseChartProps {
  readonly title: string;
  /** One label per data point, shared by every series. */
  readonly labels: readonly string[];
  readonly series: readonly ChartSeries[];
  readonly formatValue: (value: number) => string;
  readonly formatTick?: (value: number) => string;
  readonly height?: number;
  readonly className?: string;
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;

  return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10) * magnitude;
}

function extent(series: readonly ChartSeries[]): { readonly min: number; readonly max: number } {
  const all = series.flatMap((s) => s.values);
  const low = Math.min(0, ...all);
  const high = Math.max(0, ...all);

  return { min: low < 0 ? -niceCeil(-low) : 0, max: niceCeil(high) };
}

function Legend({ series }: { readonly series: readonly ChartSeries[] }): React.JSX.Element | null {
  if (series.length < 2) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
      {series.map((s, index) => (
        <li key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[index] }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function DataTableFallback({ title, labels, series, formatValue }: Pick<BaseChartProps, "title" | "labels" | "series" | "formatValue">): React.JSX.Element {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, index) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {series.map((s) => (
              <td key={s.key}>{formatValue(s.values[index] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HoverCard({ label, series, index, formatValue, x, width }: { readonly label: string; readonly series: readonly ChartSeries[]; readonly index: number; readonly formatValue: (v: number) => string; readonly x: number; readonly width: number }): React.JSX.Element {
  const flip = x > width * 0.6;

  return (
    <div className="pointer-events-none absolute top-0 z-sticky min-w-32 rounded-sm border border-border bg-surface-elevated px-2.5 py-1.5 text-sm shadow-md" style={flip ? { right: width - x + 10 } : { left: x + 10 }}>
      <p className="font-medium text-text-primary">{label}</p>
      {series.map((s, i) => (
        <p key={s.key} className="mt-0.5 flex items-center justify-between gap-4 text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: SERIES[i] }} aria-hidden />
            {s.label}
          </span>
          <span className="font-medium tabular text-text-primary">{formatValue(s.values[index] ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

const PAD = { top: 8, right: 8, bottom: 22, left: 44 };

function useScale(series: readonly ChartSeries[], width: number, height: number) {
  return useMemo(() => {
    const { min, max } = extent(series);
    const innerW = Math.max(0, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const y = (value: number): number => PAD.top + innerH - ((value - min) / (max - min || 1)) * innerH;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);

    return { min, max, innerW, innerH, y, ticks };
  }, [series, width, height]);
}

function Axes({ width, scale, labels, xAt, formatTick }: { readonly width: number; readonly scale: ReturnType<typeof useScale>; readonly labels: readonly string[]; readonly xAt: (index: number) => number; readonly formatTick: (v: number) => string }): React.JSX.Element {
  const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(scale.innerW / 64))));

  return (
    <g className="text-[10px]" fill="var(--bn-text-muted)">
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={width - PAD.right} y1={scale.y(tick)} y2={scale.y(tick)} stroke="var(--bn-border)" strokeWidth={1} strokeDasharray={tick === 0 ? undefined : "2 3"} />
          <text x={PAD.left - 6} y={scale.y(tick)} textAnchor="end" dominantBaseline="middle" className="tabular">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {labels.map((label, index) =>
        index % step === 0 ? (
          <text key={label} x={xAt(index)} y={PAD.top + scale.innerH + 14} textAnchor={xAt(index) + 24 > width ? "end" : "middle"}>
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}

/** Change over time for up to three series on one shared axis. */
export function TimeSeriesChart({ title, labels, series, formatValue, formatTick = formatValue, height = 220, area = false, className }: BaseChartProps & { readonly area?: boolean }): React.JSX.Element {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | undefined>();
  const shown = series.slice(0, SERIES.length);
  const scale = useScale(shown, width, height);
  const xAt = (index: number): number => PAD.left + (labels.length <= 1 ? scale.innerW / 2 : (index / (labels.length - 1)) * scale.innerW);

  return (
    <figure className={cn("space-y-2", className)}>
      <Legend series={shown} />
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={title}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = (event.clientX - rect.left - PAD.left) / (scale.innerW || 1);

              setHover(Math.max(0, Math.min(labels.length - 1, Math.round(ratio * (labels.length - 1)))));
            }}
            onPointerLeave={() => {
              setHover(undefined);
            }}
          >
            <Axes width={width} scale={scale} labels={labels} xAt={xAt} formatTick={formatTick} />
            {shown.map((s, i) => {
              const points = s.values.map((v, index) => `${String(xAt(index))},${String(scale.y(v))}`).join(" ");

              return (
                <g key={s.key}>
                  {area && shown.length === 1 && <polygon points={`${String(xAt(0))},${String(scale.y(0))} ${points} ${String(xAt(s.values.length - 1))},${String(scale.y(0))}`} fill={SERIES[i]} opacity={0.12} />}
                  <polyline points={points} fill="none" stroke={SERIES[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
            {hover !== undefined && (
              <g>
                <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + scale.innerH} stroke="var(--bn-border-strong)" strokeWidth={1} />
                {shown.map((s, i) => (
                  <circle key={s.key} cx={xAt(hover)} cy={scale.y(s.values[hover] ?? 0)} r={4} fill={SERIES[i]} stroke="var(--bn-surface)" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover !== undefined && <HoverCard label={labels[hover] ?? ""} series={shown} index={hover} formatValue={formatValue} x={xAt(hover)} width={width} />}
      </div>
      <DataTableFallback title={title} labels={labels} series={shown} formatValue={formatValue} />
    </figure>
  );
}

/** Magnitude per period. Series sit side by side, anchored to the baseline. */
export function BarChart({ title, labels, series, formatValue, formatTick = formatValue, height = 220, className }: BaseChartProps): React.JSX.Element {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | undefined>();
  const shown = series.slice(0, SERIES.length);
  const scale = useScale(shown, width, height);
  const band = scale.innerW / Math.max(1, labels.length);
  const group = Math.min(band * 0.7, 18 * shown.length + 2 * (shown.length - 1));
  const bar = (group - 2 * (shown.length - 1)) / shown.length;
  const xAt = (index: number): number => PAD.left + band * index + band / 2;

  return (
    <figure className={cn("space-y-2", className)}>
      <Legend series={shown} />
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={title}
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();

              setHover(Math.max(0, Math.min(labels.length - 1, Math.floor((event.clientX - rect.left - PAD.left) / (band || 1)))));
            }}
            onPointerLeave={() => {
              setHover(undefined);
            }}
          >
            <Axes width={width} scale={scale} labels={labels} xAt={xAt} formatTick={formatTick} />
            {hover !== undefined && <rect x={PAD.left + band * hover} y={PAD.top} width={band} height={scale.innerH} fill="var(--bn-surface-hover)" />}
            {labels.map((label, index) =>
              shown.map((s, i) => {
                const value = s.values[index] ?? 0;
                const top = scale.y(Math.max(0, value));
                const h = Math.max(1, Math.abs(scale.y(value) - scale.y(0)));
                const x = xAt(index) - group / 2 + i * (bar + 2);
                const r = Math.min(4, bar / 2, h);

                return <path key={`${label}-${s.key}`} d={value >= 0 ? `M${String(x)},${String(top + h)}V${String(top + r)}q0,${String(-r)} ${String(r)},${String(-r)}h${String(bar - 2 * r)}q${String(r)},0 ${String(r)},${String(r)}V${String(top + h)}z` : `M${String(x)},${String(top)}V${String(top + h - r)}q0,${String(r)} ${String(r)},${String(r)}h${String(bar - 2 * r)}q${String(r)},0 ${String(r)},${String(-r)}V${String(top)}z`} fill={SERIES[i]} />;
              }),
            )}
          </svg>
        )}
        {hover !== undefined && <HoverCard label={labels[hover] ?? ""} series={shown} index={hover} formatValue={formatValue} x={xAt(hover)} width={width} />}
      </div>
      <DataTableFallback title={title} labels={labels} series={shown} formatValue={formatValue} />
    </figure>
  );
}

export interface RankedBar {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly detail?: string;
}

/** Ranked magnitudes with the value written on every row; one hue, because the rows differ in size, not kind. */
export function RankedBars({ title, items, formatValue, limit, className }: { readonly title: string; readonly items: readonly RankedBar[]; readonly formatValue: (v: number) => string; readonly limit?: number; readonly className?: string }): React.JSX.Element {
  const max = Math.max(1, limit ?? 0, ...items.map((i) => i.value));

  return (
    <ul aria-label={title} className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-text-secondary">
              {item.label}
              {item.detail !== undefined && <span className="ml-1.5 text-text-muted">{item.detail}</span>}
            </span>
            <span className="font-medium tabular text-text-primary">{formatValue(item.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-series-1" style={{ width: item.value <= 0 ? 0 : `${String(Math.max(1, (item.value / max) * 100))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A trend at a glance beside a number. Decorative: the number next to it is the accessible value. */
export function Sparkline({ values, width = 80, height = 24, className }: { readonly values: readonly number[]; readonly width?: number; readonly height?: number; readonly className?: string }): React.JSX.Element {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((v, i) => `${String((i / Math.max(1, values.length - 1)) * (width - 4) + 2)},${String(height - 2 - ((v - min) / (max - min || 1)) * (height - 4))}`).join(" ");

  return (
    <svg width={width} height={height} aria-hidden className={className}>
      <polyline points={points} fill="none" stroke="var(--bn-series1)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
