/**
 * The dependency-probe contract.
 *
 * A probe actually talks to the thing it names. A service declares only the
 * dependencies it genuinely has, so `/ready` cannot report a dependency the
 * service does not use, and cannot report one as healthy without having
 * just reached it.
 */

/** A named check that answers "can I reach this right now?". */
export interface DependencyProbe {
  readonly name: string;
  /** Resolves when the dependency answered; rejects when it did not. */
  readonly check: (signal: AbortSignal) => Promise<void>;
  /**
   * Whether the service can serve without this dependency.
   *
   * A failing optional dependency makes the service `degraded` but still
   * ready; a failing required one makes it `unavailable`.
   */
  readonly optional?: boolean;
}

/** How long a single probe may run before it is abandoned. */
export const PROBE_TIMEOUT_MS = 2000;
