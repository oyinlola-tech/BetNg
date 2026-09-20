import { useCallback, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import {
  canBet,
  isSelected as isSlipSelected,
  type MarketKind,
  type MarketView,
  type MatchSummary,
  type SelectionView,
} from "@betng/ui-core";
import { useMarkets } from "../../hooks/queries";
import { useBetSlip } from "../../stores/betslip.store";
import { Countdown, EmptyState, ErrorState, MarketCard, Skeleton, Tabs } from "@betng/ui-web";

type Group = "ALL" | "MAIN" | "GOALS" | "SCORE";

const GROUPS: Record<Exclude<Group, "ALL">, readonly MarketKind[]> = {
  MAIN: ["MATCH_RESULT", "DOUBLE_CHANCE", "GOAL_SPREAD"],
  GOALS: ["OVER_UNDER", "BOTH_TEAMS_TO_SCORE"],
  SCORE: ["CORRECT_SCORE"],
};

export function MarketsPanel({
  match,
  className,
}: {
  readonly match: MatchSummary;
  readonly className?: string;
}): React.JSX.Element {
  const bettable = canBet(match.phase);
  const { data, isPending, isError, error, refetch } = useMarkets(
    match.id,
    bettable,
  );
  const [group, setGroup] = useState<Group>("ALL");
  const selections = useBetSlip((s) => s.selections);
  const toggle = useBetSlip((s) => s.toggle);

  const isSelected = useCallback(
    (id: string) => isSlipSelected(selections, id),
    [selections],
  );

  const onToggle = useCallback(
    (market: MarketView, selection: SelectionView) => {
      toggle({
        selectionId: selection.id,
        marketId: market.id,
        matchId: match.id,
        marketKind: market.kind,
        marketName: market.name,
        selectionLabel: selection.label,
        odds: selection.odds,
        matchLabel: `${match.home.name} v ${match.away.name}`,
        leagueCode: match.leagueCode,
        kickoffAt: match.kickoffAt,
      });
    },
    [toggle, match],
  );

  const visible = useMemo(() => {
    const markets = data?.markets ?? [];

    return group === "ALL"
      ? markets
      : markets.filter((m) => GROUPS[group].includes(m.kind));
  }, [data, group]);

  if (isError)
    return (
      <ErrorState
        compact
        error={error}
        onRetry={() => void refetch()}
        className={className}
      />
    );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Market group"
          variant="segmented"
          value={group}
          onChange={setGroup}
          items={[
            { value: "ALL", label: "All" },
            { value: "MAIN", label: "Main" },
            { value: "GOALS", label: "Goals" },
            { value: "SCORE", label: "Correct score" },
          ]}
          className="w-full sm:w-auto"
        />
        {bettable ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
            <Clock className="size-3.5" aria-hidden />
            Betting closes in{" "}
            <Countdown
              to={match.bettingClosesAt}
              className="font-semibold text-text-primary"
            />
          </span>
        ) : (
          <span className="text-sm text-text-muted">
            {match.phase === "SCHEDULED"
              ? "Markets open with the next matchday"
              : "Markets suspended"}
          </span>
        )}
      </div>

      {isPending ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-surface p-3"
              aria-busy
            >
              <Skeleton className="h-4 w-28" />
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          compact
          title="No markets"
          description="Nothing is priced for this match right now."
        />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {visible.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              isSelected={isSelected}
              onToggle={onToggle}
              className={
                market.kind === "CORRECT_SCORE" ? "md:col-span-2" : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
