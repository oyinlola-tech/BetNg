/**
 * The TV client's routes.
 *
 * A TV shows one match at a time, selected by the URL it was pointed at —
 * `?match=<id>` — because a display has no navigation and is configured by
 * whoever set it up rather than by a viewer.
 */

import { BroadcastPage } from "../pages/index";

/**
 * Resolves the match this display was configured to show.
 *
 * @param search - The browser's query string.
 * @returns The element to render.
 */
export function resolveRoute(search: string): React.JSX.Element {
  const matchId = new URLSearchParams(search).get("match");

  if (matchId === null || matchId === "") {
    return (
      <section>
        <h2>No match selected</h2>
        <p>
          Point this display at a match: <code>?match=&lt;matchId&gt;</code>
        </p>
      </section>
    );
  }

  return <BroadcastPage matchId={matchId} />;
}
