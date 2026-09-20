/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: "mock" | "platform";
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_LIVE_URL?: string;
  readonly VITE_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
