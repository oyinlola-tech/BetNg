import Constants from "expo-constants";
import { readClientEnv, type RawEnv } from "@betng/ui-core";

interface ExpoExtra {
  readonly appEnv?: string;
  readonly dataSource?: string;
  readonly apiUrl?: string;
  readonly realtimeUrl?: string;
  readonly realtimeTransport?: string;
  readonly realtimeAuth?: string;
  readonly featureFlags?: string;
  readonly requestTimeoutMs?: string;
  readonly logLevel?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;

const raw: RawEnv = {
  PROD: !__DEV__,
  VITE_APP_ENV: extra.appEnv,
  VITE_DATA_SOURCE: extra.dataSource,
  VITE_API_URL: extra.apiUrl,
  VITE_WS_URL: extra.realtimeUrl,
  VITE_REALTIME_TRANSPORT: extra.realtimeTransport,
  VITE_REALTIME_AUTH: extra.realtimeAuth,
  VITE_FEATURE_FLAGS: extra.featureFlags,
  VITE_REQUEST_TIMEOUT_MS: extra.requestTimeoutMs ?? "15000",
  VITE_LOG_LEVEL: extra.logLevel,
};

export const env = readClientEnv(raw);
