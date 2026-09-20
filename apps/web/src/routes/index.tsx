/**
 * The web client's routes.
 *
 * Deliberately a plain path match rather than a router dependency. The
 * client has two screens in this phase, and adding a router before there
 * are routes to justify it would be a dependency chosen in advance of the
 * problem. It arrives with the screens that need nested layouts.
 */

import { LobbyPage, MatchPage } from "../pages/index";

const MATCH_PATH = /^\/matches\/([0-9a-fA-F-]{36})$/;

/**
 * Resolves the current location to a screen.
 *
 * @param pathname - The browser's current path.
 * @returns The element to render.
 */
export function resolveRoute(pathname: string): React.JSX.Element {
  const match = MATCH_PATH.exec(pathname);

  if (match?.[1] !== undefined) {
    return <MatchPage matchId={match[1]} />;
  }

  return <LobbyPage />;
}
