import type { AdminSession } from "@betng/contracts";
import {
  COOKIE_SESSION_TOKEN,
  configureCurrency,
  configureDateTime,
  createPlatformAdminSource,
  createPlatformComplianceSource,
  createPlatformClients,
  createPlatformDataSource,
  createSessionStore,
  currentCurrency,
  resolveFlags,
  withoutCredential,
  type AdminDataSource,
  type ComplianceDataSource,
  type BetNgDataSource,
  type FeatureFlags,
  type PlatformConfigView,
  type SessionStore,
} from "@betng/ui-core";
import { env } from "../configs/env";
import { logger } from "./logger";
import type { DemoSignIn } from "./mockSources";
import { localStorageAdapter, sessionStorageAdapter } from "./storage";

export { env, logger };
export type { DemoSignIn };

export interface RuntimeInfo {
  readonly flags: FeatureFlags;
  readonly config: PlatformConfigView;
}

const SESSION_KEY = "betng.admin.session";

let activeSession: SessionStore<AdminSession> = createSessionStore<AdminSession>(SESSION_KEY);
let detachSession: (() => void) | undefined;
const sessionListeners = new Set<() => void>();

function notifySession(): void {
  for (const listener of sessionListeners) listener();
}

function adoptSession(store: SessionStore<AdminSession>): void {
  detachSession?.();
  activeSession = store;
  detachSession = store.subscribe(notifySession);
  notifySession();
}

/* One stable store for the app; the source that owns the real one is adopted at start-up. */
export const session: SessionStore<AdminSession> = {
  snapshot: () => activeSession.snapshot(),
  token: () => activeSession.token(),
  set: (next) => {
    activeSession.set(next);
  },
  clear: () => {
    activeSession.clear();
  },
  expire: () => {
    activeSession.expire();
  },
  subscribe: (listener) => {
    sessionListeners.add(listener);

    return () => {
      sessionListeners.delete(listener);
    };
  },
};

function notReady(): never {
  throw new Error("initRuntime() has not completed.");
}

const pending = new Proxy({}, { get: notReady });

export let dataSource: BetNgDataSource = pending as BetNgDataSource;
export let adminSource: AdminDataSource = pending as AdminDataSource;
export let compliance: ComplianceDataSource = pending as ComplianceDataSource;

/* Development sign-ins, filled only when the mock is loaded. Always empty in a deployed build. */
export let demoSignIns: readonly DemoSignIn[] = [];

let info: RuntimeInfo | undefined;

async function createSources(): Promise<void> {
  if (env.dataSource === "mock" && (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "test")) {
    const { createMockSources } = await import("./mockSources");
    const mock = createMockSources({ session: sessionStorageAdapter, local: localStorageAdapter });

    dataSource = mock.dataSource;
    adminSource = mock.adminSource;
    compliance = mock.compliance;
    demoSignIns = mock.demoSignIns;
    adoptSession(mock.adminSource.session);

    return;
  }

  const cookieSession = env.authTransport === "cookie";
  const store = createSessionStore<AdminSession>(SESSION_KEY, cookieSession ? withoutCredential(sessionStorageAdapter) : sessionStorageAdapter);
  const { rest, realtime } = createPlatformClients({
    env,
    getToken: () => {
      const token = store.token();

      return cookieSession || token === COOKIE_SESSION_TOKEN ? undefined : token;
    },
    onUnauthorized: () => {
      store.expire();
    },
    logger,
  });

  let lastToken = store.token();

  store.subscribe(() => {
    const token = store.token();

    if (token === lastToken) return;

    lastToken = token;
    realtime.replaceConnection();
  });

  dataSource = createPlatformDataSource({ rest, realtime, userId: () => undefined, storage: localStorageAdapter });
  adminSource = createPlatformAdminSource(rest, store);
  compliance = createPlatformComplianceSource(rest, store);
  adoptSession(store);
}

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  await createSources();

  let config: PlatformConfigView | undefined;

  try {
    config = await dataSource.getPlatformConfig();
    configureCurrency(config.currency);
    configureDateTime(config.competitionTimezone === undefined ? {} : { competitionTimeZone: config.competitionTimezone });
  } catch {
    logger.warn("flow", "Platform configuration could not be read; defaults are in use.");
  }

  info = {
    flags: resolveFlags(config?.features, env.flagOverrides),
    config: config ?? { currency: currentCurrency(), features: {} },
  };

  return info;
}

export function __setRuntimeForTests(sources: { readonly dataSource: BetNgDataSource; readonly adminSource: AdminDataSource; readonly compliance?: ComplianceDataSource; readonly demoSignIns?: readonly DemoSignIn[] }): void {
  dataSource = sources.dataSource;
  adminSource = sources.adminSource;
  if (sources.compliance !== undefined) compliance = sources.compliance;
  demoSignIns = sources.demoSignIns ?? [];
  adoptSession(sources.adminSource.session);
}
