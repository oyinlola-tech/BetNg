/**
 * The dependency-probe contract.
 *
 * A probe actually talks to the thing it names. A service declares only the
 * dependencies it genuinely has, so `/ready` cannot report a dependency the
 * service does not use, and cannot report one as healthy without having
 * just reached it.
 */

export interface DependencyProbe {
  readonly name: string;
  readonly check: (signal: AbortSignal) => Promise<void>;
  /**
   * Whether the service can serve without this dependency.
   *
   * A failing optional dependency makes the service `degraded` but still
   * ready; a failing required one makes it `unavailable`.
   */
  readonly optional?: boolean;
}

export const PROBE_TIMEOUT_MS = 2000;
