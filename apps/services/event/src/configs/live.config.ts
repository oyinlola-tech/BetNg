export interface LiveSettings {
  readonly maxConnectionsPerIp: number;
  readonly revalidateMs: number;
  readonly trustedProxyHops: number;
  readonly maxFramesPerWindow: number;
  readonly frameWindowMs: number;
  readonly maxChannelsPerConnection: number;
  readonly maxAuthAttempts: number;
}

type Env = Readonly<Record<string, string | undefined>>;

function integer(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];

  if (raw === undefined || raw === "") return fallback;

  const value = Number(raw);

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${String(min)} and ${String(max)}, got "${raw}".`);
  }

  return value;
}

export function loadLiveSettings(env: Env = process.env): LiveSettings {
  return Object.freeze({
    maxConnectionsPerIp: integer(env, "EVENT_MAX_CONNECTIONS_PER_IP", 20, 1, 10_000),
    revalidateMs: integer(env, "EVENT_AUTH_REVALIDATE_SECONDS", 30, 1, 300) * 1000,
    trustedProxyHops: integer(env, "EVENT_TRUSTED_PROXY_HOPS", 0, 0, 5),
    maxFramesPerWindow: integer(env, "EVENT_MAX_FRAMES_PER_10S", 60, 5, 10_000),
    frameWindowMs: 10_000,
    maxChannelsPerConnection: integer(env, "EVENT_MAX_CHANNELS_PER_CONNECTION", 50, 1, 1000),
    maxAuthAttempts: 5,
  });
}
