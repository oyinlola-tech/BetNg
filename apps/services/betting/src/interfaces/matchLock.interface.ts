/**
 * Serialises placement on a match, so two slips are never assessed against
 * the same exposure at once.
 */
export type MatchLockResult<T> =
  | { readonly acquired: true; readonly value: T }
  | { readonly acquired: false };

export interface MatchLock {
  /**
   * Runs `task` holding every match's lock. Resolves `acquired: false`,
   * without running it, when a lock could not be taken or Redis could not be
   * reached: a bet is never placed unlocked.
   */
  withMatches<T>(
    matchIds: readonly string[],
    task: () => Promise<T>,
  ): Promise<MatchLockResult<T>>;
}
