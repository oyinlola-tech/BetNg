/**
 * One idempotency key per logical attempt: retries of the same request reuse it,
 * and any change to what is being asked for (or a reset) starts a new attempt.
 */
export interface AttemptKey {
  keyFor(fingerprint: string): string;
  reset(): void;
}

export function createAttemptKey(newKey: () => string): AttemptKey {
  let current: { readonly fingerprint: string; readonly key: string } | undefined;

  return {
    keyFor: (fingerprint) => {
      if (current?.fingerprint !== fingerprint) current = { fingerprint, key: newKey() };

      return current.key;
    },
    reset: () => {
      current = undefined;
    },
  };
}
