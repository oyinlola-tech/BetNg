import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import {
  COLLECTION_PHASES,
  formatShortDate,
  selectCollection,
  type MatchSummary,
} from "@betng/ui-core";
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  MatchCard,
  SectionHeading,
  StaleBadge,
} from "@betng/ui-web";
import { LiveCard, MatchRows } from "../components/domain";
import { usePageMeta } from "../features/seo";
import { useIsStale, useLastSyncedAt } from "../hooks/useConnection";
import { useMatches } from "../hooks/queries";
import { paths } from "../lib/paths";

/*
 * The football page answers one question: what can I play right now. Open for
 * play leads, because that is the only collection a user can act on; matches
 * the platform has closed drop out of it into "starting soon" rather than
 * sitting there looking playable, and matches it has started belong to Live.
 *
 * Every collection is a filter over the phase the platform reported. Nothing
 * on this page moves a match between sections because a local clock passed a
 * kick-off time.
 */

const LIVE_PREVIEWS = 4;

function More({
  to,
  children,
}: {
  readonly to: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-xs text-sm font-semibold text-brand hover:underline focus-ring"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export function FootballPage(): React.JSX.Element {
  const stale = useIsStale();
  const lastSyncedAt = useLastSyncedAt();

  /*
   * One read covers every collection on the page: asking for each phase
   * separately would put the sections a poll apart, and a match could appear
   * in two of them at once while they disagreed.
   */
  const playable = useMatches({
    phases: [
      ...COLLECTION_PHASES.OPEN_FOR_PLAY,
      ...COLLECTION_PHASES.STARTING_SOON,
      ...COLLECTION_PHASES.LIVE,
      ...COLLECTION_PHASES.UPCOMING,
    ],
    limit: 80,
  });

  const matches: readonly MatchSummary[] = useMemo(
    () => playable.data ?? [],
    [playable.data],
  );

  const open = useMemo(
    () => selectCollection(matches, "OPEN_FOR_PLAY"),
    [matches],
  );
  const starting = useMemo(
    () => selectCollection(matches, "STARTING_SOON"),
    [matches],
  );
  const live = useMemo(() => selectCollection(matches, "LIVE"), [matches]);
  const upcoming = useMemo(
    () => selectCollection(matches, "UPCOMING"),
    [matches],
  );

  usePageMeta({
    title: "Football",
    description:
      "Football matches open for play on BETNG, with prices, kick-off times and matches in progress.",
    path: "/football",
  });

  const empty =
    open.length === 0 &&
    starting.length === 0 &&
    live.length === 0 &&
    upcoming.length === 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="type-h1">Football</h1>
          <p className="mt-1 text-base text-text-secondary">
            Matches you can play now, and what is coming next.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stale && <StaleBadge updatedAt={lastSyncedAt} />}
          <p className="type-data text-text-muted">
            {formatShortDate(new Date().toISOString())}
          </p>
        </div>
      </header>

      {playable.isPending ? (
        <div
          className="grid gap-3 sm:grid-cols-2"
          role="status"
          aria-label="Loading matches"
        >
          {[0, 1, 2, 3].map((slot) => (
            <MatchCard.Skeleton key={slot} variant="standard" />
          ))}
        </div>
      ) : playable.isError && playable.data === undefined ? (
        <div className="rounded-md border border-border bg-surface">
          <ErrorState
            error={playable.error}
            onRetry={() => void playable.refetch()}
          />
        </div>
      ) : empty ? (
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            title="No matches available"
            description="There is nothing open for play right now. Live matches and results are still available."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  to={paths.live}
                  className="rounded-sm border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-hover focus-ring"
                >
                  Live matches
                </Link>
                <Link
                  to={paths.results}
                  className="rounded-sm border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-hover focus-ring"
                >
                  Results
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section aria-labelledby="football-open">
              <SectionHeading
                id="football-open"
                action={<More to={paths.virtuals}>All fixtures</More>}
              >
                Open for play
              </SectionHeading>
              <MatchRows
                matches={open}
                variant="standard"
                layout="grid"
                withMarkets
                stale={stale}
                label="Matches open for play"
                className="mt-3"
              />
            </section>
          )}

          {starting.length > 0 && (
            <section aria-labelledby="football-starting">
              <SectionHeading id="football-starting">
                Starting soon
              </SectionHeading>
              <p className="type-small mt-1 text-text-muted">
                Betting has closed on these matches. They kick off shortly.
              </p>
              <MatchRows
                matches={starting}
                variant="compact"
                layout="rows"
                stale={stale}
                label="Matches starting soon"
                className="mt-3"
              />
            </section>
          )}

          {live.length > 0 && (
            <section aria-labelledby="football-live">
              <SectionHeading
                id="football-live"
                action={<More to={paths.live}>All live</More>}
              >
                Live now
              </SectionHeading>
              <ErrorBoundary scope="feature">
                <ul
                  className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3"
                  aria-label="Live matches"
                >
                  {live.slice(0, LIVE_PREVIEWS).map((match) => (
                    <li key={match.id} className="min-w-0">
                      <LiveCard summary={match} stale={stale} />
                    </li>
                  ))}
                </ul>
              </ErrorBoundary>
            </section>
          )}

          {upcoming.length > 0 && (
            <section aria-labelledby="football-upcoming">
              <SectionHeading
                id="football-upcoming"
                action={
                  <More to={`${paths.virtuals}?state=upcoming`}>Fixtures</More>
                }
              >
                Upcoming
              </SectionHeading>
              <MatchRows
                matches={upcoming.slice(0, 8)}
                variant="compact"
                layout="rows"
                label="Upcoming matches"
                className="mt-3"
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
