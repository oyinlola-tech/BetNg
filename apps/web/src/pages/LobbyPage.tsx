/**
 * The virtual football lobby.
 *
 * Lists the platform's matches. This phase renders the data the match
 * service actually serves and nothing more — markets, the bet slip and the
 * wallet are separate pages that land with the screens they belong to.
 */

import { useMatches } from "../hooks/index";

export function LobbyPage(): React.JSX.Element {
  const { matches, loading, error } = useMatches();

  if (loading) {
    return <p>Loading matches…</p>;
  }

  if (error !== undefined) {
    return (
      <div role="alert">
        <h2>The lobby could not be loaded</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return <p>No matches are scheduled.</p>;
  }

  return (
    <section aria-labelledby="lobby-heading">
      <h2 id="lobby-heading">Matches</h2>
      <ul>
        {matches.map((match) => (
          <li key={match.id}>
            <a href={`/matches/${match.id}`}>
              {match.id} — {match.status}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
