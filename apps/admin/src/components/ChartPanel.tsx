import { useState } from "react";
import { EmptyState, ErrorBoundary, ErrorState, Panel, SkeletonRows, Tabs } from "@betng/ui-web";

export interface FigureColumn {
  readonly key: string;
  readonly header: string;
  readonly numeric?: boolean;
}

export type FigureRow = Readonly<Record<string, React.ReactNode>> & { readonly key: string };

export interface ChartPanelProps {
  readonly title: string;
  readonly description?: string;
  readonly state: { readonly data: unknown; readonly error: unknown; readonly refetch: () => unknown };
  readonly isEmpty: boolean;
  readonly chart: () => React.ReactNode;
  readonly columns: readonly FigureColumn[];
  readonly rows: () => readonly FigureRow[];
  readonly className?: string;
}

type View = "chart" | "table";

/** A chart with the same figures as a table one tap away. */
export function ChartPanel({ title, description, state, isEmpty, chart, columns, rows, className }: ChartPanelProps): React.JSX.Element {
  const [view, setView] = useState<View>("chart");

  return (
    <Panel
      title={title}
      {...(description === undefined ? {} : { description })}
      {...(className === undefined ? {} : { className })}
      flush={view === "table"}
      actions={
        <Tabs<View>
          label={`${title}: view`}
          variant="segmented"
          value={view}
          onChange={setView}
          items={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      }
    >
      <ErrorBoundary scope="feature">
        {state.data === undefined ? (
          state.error !== null && state.error !== undefined ? (
            <ErrorState error={state.error} compact onRetry={() => void state.refetch()} />
          ) : (
            <SkeletonRows rows={5} {...(view === "table" ? { className: "p-4" } : {})} />
          )
        ) : isEmpty ? (
          <EmptyState compact title="No figures for this window" description="The platform reports no bets here. Try a wider window." />
        ) : view === "chart" ? (
          chart()
        ) : (
          <div className="max-h-80 overflow-auto scrollbar-thin">
            <table className="w-full border-collapse text-left text-base">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="border-b border-border">
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className={`caps-label sticky top-0 whitespace-nowrap bg-surface px-4 py-2 ${column.numeric === true ? "text-right" : "text-left"}`}>
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows().map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-b-0">
                    {columns.map((column) => (
                      <td key={column.key} className={`px-4 py-2 ${column.numeric === true ? "whitespace-nowrap text-right tabular" : ""}`}>
                        {row[column.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ErrorBoundary>
    </Panel>
  );
}
