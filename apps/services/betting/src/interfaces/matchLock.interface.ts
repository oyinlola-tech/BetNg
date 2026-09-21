export type MatchLockResult<T> =
  | { readonly acquired: true; readonly value: T }
  | { readonly acquired: false };

export interface MatchLock {
  // `acquired: false` means the task did not run: a bet is never placed unlocked.
  withMatches<T>(
    matchIds: readonly string[],
    task: () => Promise<T>,
  ): Promise<MatchLockResult<T>>;
}
