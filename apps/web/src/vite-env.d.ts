/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_REALTIME_TRANSPORT?: string;
  readonly VITE_REALTIME_AUTH?: string;
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_FEATURE_FLAGS?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_LOG_LEVEL?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
