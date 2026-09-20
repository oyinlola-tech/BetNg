/**
 * The broadcast screen.
 *
 * TV differs from web and mobile in what it optimises for: nobody is
 * touching it. It shows one match, full-screen, and must stay correct for
 * ninety minutes unattended. That shapes three things here — the connection
 * state is always visible so a wall display shows when it is stale, the
 * event feed is capped so an all-day session cannot grow without bound, and
 * the score comes from the latest frame rather than being accumulated.
 */

import { useLiveMatch } from "../hooks/index";

/**
 * How many events the timeline keeps on screen.
 *
 * A display left running for a full matchday would otherwise accumulate
 * every event of every match it showed.
 */
const TIMELINE_LIMIT = 12;

export interface BroadcastPageProps {
  readonly matchId: string;
}

export function BroadcastPage({
  matchId,
}: BroadcastPageProps): React.JSX.Element {
  const { match, events, score, connected, error } = useLiveMatch(matchId);

  const timeline = events.slice(-TIMELINE_LIMIT).reverse();
  const clock = events.at(-1)?.minute ?? 0;

  return (
    <section className="broadcast" aria-labelledby="broadcast-heading">
      <header>
        <h2 id="broadcast-heading">BetNG TV</h2>
        {/* Always visible: an unattended display must show when what it is
            showing has stopped being current. */}
        <p aria-live="polite">
          {connected ? "LIVE" : "RECONNECTING"}
          {match !== undefined && ` · ${match.status}`}
        </p>
      </header>

      <div className="scoreboard">
        <span className="score">
          {score.home} – {score.away}
        </span>
        <span className="clock">{clock}&apos;</span>
      </div>

      {error !== undefined && <p role="alert">{error}</p>}

      <ol className="timeline">
        {timeline.map((event) => (
          <li key={`${event.matchId}-${String(event.sequence)}`}>
            <span className="minute">{event.minute}&apos;</span>
            <span className="type">{event.type}</span>
            <span className="description">{event.description}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
