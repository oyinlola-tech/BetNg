/**
 * One match, with its live event feed.
 *
 * Demonstrates the pattern every live surface uses: state read over REST,
 * live frames applied on top, and a re-read whenever the stream reports it
 * missed something.
 */

import { useLiveMatch } from "../hooks/index";

export interface MatchPageProps {
  readonly matchId: string;
}

export function MatchPage({ matchId }: MatchPageProps): React.JSX.Element {
  const { match, events, score, connected, error } = useLiveMatch(matchId);

  return (
    <section aria-labelledby="match-heading">
      <h2 id="match-heading">Match {matchId}</h2>

      <p>
        {score.home} – {score.away}{" "}
        <span aria-live="polite">{connected ? "live" : "reconnecting…"}</span>
      </p>

      {match !== undefined && <p>Status: {match.status}</p>}
      {error !== undefined && <p role="alert">{error}</p>}

      <ol>
        {events.map((event) => (
          <li key={`${event.matchId}-${String(event.sequence)}`}>
            {event.minute}&apos; {event.type} — {event.description}
          </li>
        ))}
      </ol>
    </section>
  );
}
