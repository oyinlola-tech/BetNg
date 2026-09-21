import { History } from "lucide-react";
import type { LimitHistoryEntry } from "@betng/contracts";
import { formatDateTime } from "@betng/ui-core";
import { EmptyState } from "@betng/ui-web";
import { HISTORY_ACTION, LIMIT_LABEL, formatLimitValue } from "./limitMeta";

function describe(entry: LimitHistoryEntry): string {
  if (entry.kind === "self_exclude") return "Self-exclusion";

  const label = LIMIT_LABEL[entry.kind];
  const from = entry.previousValue === undefined ? undefined : formatLimitValue(entry.kind, entry.previousValue);
  const to = entry.value === undefined ? undefined : formatLimitValue(entry.kind, entry.value);

  if (from !== undefined && to !== undefined) return `${label}: ${from} to ${to}`;
  if (to !== undefined) return `${label}: ${to}`;
  if (from !== undefined) return `${label}: was ${from}`;

  return label;
}

export function LimitHistory({ entries }: { readonly entries: readonly LimitHistoryEntry[] }): React.JSX.Element {
  if (entries.length === 0) return <EmptyState compact icon={<History className="size-5" />} title="No changes yet" description="Every limit you set, change or remove is recorded here." />;

  return (
    <ol className="divide-y divide-border" aria-label="Limit history">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
          <span className="min-w-0">
            <span className="type-body block text-text-primary">{describe(entry)}</span>
            <span className="type-small text-text-muted">{HISTORY_ACTION[entry.action]}</span>
          </span>
          <time dateTime={entry.at} className="type-small tabular text-text-muted">
            {formatDateTime(entry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
