/// <reference types="vite/client" />

/**
 * The environment variables this client reads.
 *
 * Declared so a typo in `import.meta.env` is a compile error rather than
 * `undefined` at runtime, which would silently fall back to localhost.
 */
interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_LIVE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
