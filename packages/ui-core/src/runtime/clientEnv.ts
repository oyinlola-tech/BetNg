import { parseFlagOverrides } from "../flags.js";
import type { FeatureFlags } from "../types/index.js";

export type AppEnvironment = "development" | "test" | "staging" | "production";
export type DataSourceMode = "mock" | "platform";

export interface ClientEnv {
  readonly appEnv: AppEnvironment;
  readonly dataSource: DataSourceMode;
  readonly apiUrl: string;
  readonly realtimeUrl: string;
  readonly realtimeTransport: "websocket" | "sse";
  readonly realtimeAuth: "none" | "frame" | "query";
  readonly requestTimeoutMs: number;
  readonly flagOverrides: Partial<FeatureFlags>;
  readonly logLevel: "debug" | "info" | "warn" | "error";
  readonly siteUrl: string | undefined;
  readonly problems: readonly string[];
}

export type RawEnv = Readonly<Record<string, string | boolean | undefined>>;

const ENVIRONMENTS: readonly AppEnvironment[] = ["development", "test", "staging", "production"];

function text(raw: RawEnv, ...names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = raw[name];

    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }

  return undefined;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function validUrl(value: string, protocols: readonly string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Reads a browser app's build-time environment. Only the public gateway and
 * the public realtime endpoint are ever configured here. The platform is the
 * default everywhere; the mock is an explicit opt-in that only a development
 * or test build honours.
 */
export function readClientEnv(raw: RawEnv): ClientEnv {
  const problems: string[] = [];
  const appEnv = oneOf(text(raw, "VITE_APP_ENV"), ENVIRONMENTS, raw["PROD"] === true ? "production" : "development");
  const deployed = appEnv === "production" || appEnv === "staging";
  const requested = oneOf(text(raw, "VITE_DATA_SOURCE"), ["mock", "platform"] as const, "platform");

  if (deployed && requested === "mock") problems.push("VITE_DATA_SOURCE=mock is ignored outside development and test.");

  const apiUrl = text(raw, "VITE_API_URL", "VITE_GATEWAY_URL") ?? "http://localhost:3000";
  const realtimeUrl = text(raw, "VITE_WS_URL", "VITE_LIVE_URL") ?? "ws://localhost:3008/live";
  const realtimeTransport = oneOf(text(raw, "VITE_REALTIME_TRANSPORT"), ["websocket", "sse"] as const, "websocket");

  if (!validUrl(apiUrl, ["http:", "https:"])) problems.push("VITE_API_URL is not an http(s) URL.");
  if (!validUrl(realtimeUrl, realtimeTransport === "sse" ? ["http:", "https:"] : ["ws:", "wss:"])) {
    problems.push("VITE_WS_URL does not match the realtime transport.");
  }
  if (deployed && (apiUrl.startsWith("http:") || realtimeUrl.startsWith("ws:"))) {
    problems.push("A deployed build should reach the platform over TLS.");
  }

  const timeout = Number(text(raw, "VITE_REQUEST_TIMEOUT_MS"));

  return Object.freeze({
    appEnv,
    dataSource: deployed ? "platform" : requested,
    apiUrl,
    realtimeUrl,
    realtimeTransport,
    realtimeAuth: oneOf(text(raw, "VITE_REALTIME_AUTH"), ["none", "frame", "query"] as const, "none"),
    requestTimeoutMs: Number.isFinite(timeout) && timeout >= 1_000 ? timeout : 10_000,
    flagOverrides: parseFlagOverrides(text(raw, "VITE_FEATURE_FLAGS")),
    logLevel: oneOf(text(raw, "VITE_LOG_LEVEL"), ["debug", "info", "warn", "error"] as const, deployed ? "warn" : "info"),
    siteUrl: text(raw, "VITE_SITE_URL"),
    problems,
  });
}
