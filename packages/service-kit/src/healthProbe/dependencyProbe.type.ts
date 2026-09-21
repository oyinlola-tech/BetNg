export interface DependencyProbe {
  readonly name: string;
  readonly check: (signal: AbortSignal) => Promise<void>;
  readonly optional?: boolean;
}

export const PROBE_TIMEOUT_MS = 2000;
