import type { MatchId } from "@betng/contracts";
import type { MatchMarketsView } from "@betng/ui-core";

/** The platform accepts this many matches in one odds read. */
const CHUNK = 60;
const WINDOW_MS = 20;

type Read = (matchIds: readonly MatchId[]) => Promise<readonly MatchMarketsView[]>;

interface Waiter {
  readonly resolve: (markets: MatchMarketsView) => void;
  readonly reject: (cause: unknown) => void;
}

export interface MarketsBatch {
  load(matchId: MatchId): Promise<MatchMarketsView>;
}

/**
 * A list of forty matches asks for forty prices. Asked one by one that is forty requests at once, and again on
 * every refresh; collected for a moment, it is one. A match the platform has no odds for answers with no markets.
 */
export function createMarketsBatch(read: Read, windowMs: number = WINDOW_MS): MarketsBatch {
  let queue = new Map<MatchId, Waiter[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = (): void => {
    const batch = queue;
    const ids = [...batch.keys()];

    queue = new Map();
    timer = undefined;

    for (let start = 0; start < ids.length; start += CHUNK) {
      const chunk = ids.slice(start, start + CHUNK);

      read(chunk).then(
        (list) => {
          const found = new Map(list.map((markets) => [markets.matchId, markets]));

          for (const id of chunk) {
            const markets = found.get(id) ?? { matchId: id, markets: [], generatedAt: new Date(0).toISOString() };

            for (const waiter of batch.get(id) ?? []) waiter.resolve(markets);
          }
        },
        (cause: unknown) => {
          for (const id of chunk) for (const waiter of batch.get(id) ?? []) waiter.reject(cause);
        },
      );
    }
  };

  return {
    load: (matchId) =>
      new Promise<MatchMarketsView>((resolve, reject) => {
        queue.set(matchId, [...(queue.get(matchId) ?? []), { resolve, reject }]);
        timer ??= setTimeout(flush, windowMs);
      }),
  };
}
