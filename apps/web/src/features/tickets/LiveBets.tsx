import { useMemo } from "react";
import { Link } from "react-router";
import { formatOdds, type BetLegView, type BetView, type MatchSummary } from "@betng/ui-core";
import { MatchCard, SectionHeading, StaleBadge, cn } from "@betng/ui-web";
import { useMarkets, useMatches } from "../../hooks/queries";
import { useIsStale, useLastSyncedAt } from "../../hooks/useConnection";
import { useLiveMatch } from "../../hooks/useLiveMatch";
import { priceStatus } from "../../hooks/useSlipPrices";
import { paths } from "../../lib/paths";

/* Each match here holds its own live subscription, so the section follows only the most recent few. */
const MAX_LIVE_MATCHES = 6;

interface LiveLeg {
  readonly bet: BetView;
  readonly leg: BetLegView;
}

export function groupLiveLegs(bets: readonly BetView[], live: readonly MatchSummary[]): readonly { readonly match: MatchSummary; readonly legs: readonly LiveLeg[] }[] {
  const byMatch = new Map<string, LiveLeg[]>();

  for (const bet of bets) {
    if (bet.status !== "PENDING") continue;

    for (const leg of bet.legs) {
      if (leg.outcome !== "PENDING") continue;

      const list = byMatch.get(leg.matchId) ?? [];

      list.push({ bet, leg });
      byMatch.set(leg.matchId, list);
    }
  }

  return live.flatMap((match) => {
    const legs = byMatch.get(match.id);

    return legs === undefined ? [] : [{ match, legs }];
  });
}

function CurrentPrice({ leg, markets }: { readonly leg: BetLegView; readonly markets: ReturnType<typeof useMarkets>["data"] }): React.JSX.Element {
  if (markets === undefined) return <span className="text-text-muted">–</span>;

  const status = priceStatus(leg, markets);

  if (status.kind === "OK") return <span className="type-odds text-text-primary">{formatOdds(leg.odds)}</span>;
  if (status.kind === "PRICE_CHANGED") return <span className="type-odds text-text-primary">{formatOdds(status.currentOdds)}</span>;

  return <span className="type-small font-semibold text-text-muted">{status.kind === "SUSPENDED" ? "Suspended" : "Closed"}</span>;
}

function LiveMatchBets({ summary, legs, stale }: { readonly summary: MatchSummary; readonly legs: readonly LiveLeg[]; readonly stale: boolean }): React.JSX.Element {
  const live = useLiveMatch(summary.id);
  const markets = useMarkets(summary.id, { poll: true });
  const match = live.match ?? summary;

  return (
    <MatchCard
      match={match}
      variant="live"
      to={paths.match(summary.id)}
      lastEvent={live.lastEvent ?? live.match?.events.at(-1)}
      stale={stale}
      markets={
        <table className="w-full text-left">
          <caption className="sr-only">Your open selections on this match</caption>
          <thead>
            <tr className="type-caption">
              <th scope="col" className="py-1 pr-2 font-semibold">
                Your selection
              </th>
              <th scope="col" className="py-1 px-2 text-right font-semibold">
                Taken at
              </th>
              <th scope="col" className="py-1 pl-2 text-right font-semibold">
                <span aria-hidden>Now</span>
                <span className="sr-only">Current platform price, for information only</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {legs.map(({ bet, leg }) => (
              <tr key={`${bet.id}-${leg.selectionId}`}>
                <th scope="row" className="min-w-0 py-1.5 pr-2 font-normal">
                  <Link to={`/tickets/${bet.id}`} className="block truncate rounded-xs type-small font-semibold text-text-primary hover:underline focus-ring">
                    {leg.selectionLabel}
                  </Link>
                  <span className="block truncate type-small text-text-muted">
                    {leg.marketName}
                    {bet.legs.length > 1 ? ` · ${String(bet.legs.length)}-fold` : ""}
                  </span>
                </th>
                <td className="py-1.5 px-2 text-right type-odds text-text-secondary">{formatOdds(leg.odds)}</td>
                <td className="py-1.5 pl-2 text-right">
                  <CurrentPrice leg={leg} markets={markets.data} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

/** Open bets on matches in play. Scores and prices are the platform's; nothing here settles or values a bet. */
export function LiveBets({ bets, className }: { readonly bets: readonly BetView[] | undefined; readonly className?: string }): React.JSX.Element | null {
  const hasOpen = bets?.some((bet) => bet.status === "PENDING") === true;
  const live = useMatches({ phases: ["LIVE", "HALFTIME"] }, { enabled: hasOpen });
  const stale = useIsStale();
  const lastSyncedAt = useLastSyncedAt();
  const groups = useMemo(() => groupLiveLegs(bets ?? [], live.data ?? []).slice(0, MAX_LIVE_MATCHES), [bets, live.data]);

  if (!hasOpen || groups.length === 0) return null;

  return (
    <section aria-labelledby="live-bets" className={cn("space-y-3", className)}>
      <SectionHeading id="live-bets" action={stale ? <StaleBadge updatedAt={lastSyncedAt} /> : undefined}>
        Live bets
      </SectionHeading>
      <p className="type-small text-text-muted">Open bets on matches in play. Prices under “Now” are the platform’s current odds, shown for information; your bet keeps the odds it was accepted at.</p>
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Matches with your open bets">
        {groups.map((group) => (
          <li key={group.match.id} className="min-w-0">
            <LiveMatchBets summary={group.match} legs={group.legs} stale={stale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
