import type { UseQueryResult } from "@tanstack/react-query";
import type { MatchSummary } from "@betng/ui-core";
import { EmptyState, ErrorState, MatchCard, cn, matchOutcome, useIsCompact, type EmptyPresetName, type MatchCardVariant } from "@betng/ui-web";
import { paths } from "../../lib/paths";
import { ResultMarket } from "./ResultMarket";

export interface MatchRowsProps {
  readonly matches: readonly MatchSummary[];
  readonly variant?: MatchCardVariant;
  readonly layout?: "rows" | "grid";
  readonly withMarkets?: boolean;
  /** Shows how a finished match ended, from the score the platform reported. */
  readonly withOutcome?: boolean;
  readonly stale?: boolean;
  readonly showCompetition?: boolean;
  readonly label: string;
  readonly className?: string | undefined;
}

export interface MatchListProps extends Omit<MatchRowsProps, "matches"> {
  readonly query: UseQueryResult<readonly MatchSummary[]>;
  readonly limit?: number;
  /** Leaves out the first matches, e.g. one already shown as the page's lead. */
  readonly skip?: number;
  readonly empty: EmptyPresetName;
  readonly emptyAction?: React.ReactNode;
  readonly skeletons?: number;
}

const GRID = "grid gap-3 sm:grid-cols-2";
const ROWS = "divide-y divide-border overflow-hidden rounded-md border border-border bg-surface";

interface Shape {
  readonly variant: MatchCardVariant;
  readonly stacked: boolean;
  readonly shell: string;
}

function useShape(wanted: MatchCardVariant, layout: "rows" | "grid", className: string | undefined): Shape {
  const compact = useIsCompact();
  const stacked = layout === "rows" && compact;

  return {
    variant: stacked ? "mobile" : wanted,
    stacked,
    shell: cn(layout === "grid" ? GRID : stacked ? "space-y-2" : ROWS, className),
  };
}

function OutcomeNote({ match }: { readonly match: MatchSummary }): React.JSX.Element | null {
  const outcome = matchOutcome(match);

  if (outcome === undefined) return null;

  const gap = Math.abs(match.score.home - match.score.away);
  const text = outcome === "DRAW" ? "Draw" : `${(outcome === "HOME" ? match.home : match.away).shortName} by ${String(gap)}`;

  return <span className="type-small block w-28 truncate text-right text-text-muted">{text}</span>;
}

export function MatchRows({
  matches,
  variant: wanted = "compact",
  layout = "rows",
  withMarkets = false,
  withOutcome = false,
  stale = false,
  showCompetition = true,
  label,
  className,
}: MatchRowsProps): React.JSX.Element {
  const { variant, stacked, shell } = useShape(wanted, layout, className);

  return (
    <ul aria-label={label} className={shell}>
      {matches.map((match) => (
        <li key={match.id} className="min-w-0">
          <MatchCard
            match={match}
            variant={variant}
            to={paths.match(match.id)}
            stale={stale}
            showCompetition={showCompetition}
            markets={
              withMarkets ? (
                <ResultMarket match={match} className={stacked || layout === "grid" ? "w-full" : "w-56"} />
              ) : withOutcome ? (
                <OutcomeNote match={match} />
              ) : undefined
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function MatchList({ query, limit, skip = 0, empty, emptyAction, skeletons = 4, ...rows }: MatchListProps): React.JSX.Element {
  const { variant, shell } = useShape(rows.variant ?? "compact", rows.layout ?? "rows", rows.className);

  if (query.isPending) {
    return (
      <div className={shell} role="status" aria-label={`Loading ${rows.label}`}>
        {Array.from({ length: skeletons }, (_, slot) => (
          <MatchCard.Skeleton key={slot} variant={variant} />
        ))}
      </div>
    );
  }

  if (query.isError && query.data === undefined) {
    return (
      <div className={cn("rounded-md border border-border bg-surface", rows.className)}>
        <ErrorState compact error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const matches = (query.data ?? []).slice(skip, limit === undefined ? undefined : skip + limit);

  if (matches.length === 0) {
    return (
      <div className={cn("rounded-md border border-border bg-surface", rows.className)}>
        <EmptyState compact preset={empty} {...(emptyAction === undefined ? {} : { action: emptyAction })} />
      </div>
    );
  }

  return <MatchRows matches={matches} {...rows} />;
}
