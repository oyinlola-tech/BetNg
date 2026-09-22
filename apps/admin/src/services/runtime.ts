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
import { localStorageAdapter, sessionStorageAdapter } from "./storage";

export { env, logger };

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

function createSources(): {
  readonly dataSource: BetNgDataSource;
  readonly adminSource: AdminDataSource;
  readonly compliance: ComplianceDataSource;
  readonly store: SessionStore<AdminSession>;
} {
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

  if (env.realtimeAuth !== "none") store.subscribe(() => {
    const token = store.token();

    if (token === lastToken) return;

    lastToken = token;
    realtime.replaceConnection();
  });

  return {
    dataSource: createPlatformDataSource({ rest, realtime, userId: () => undefined, storage: localStorageAdapter }),
    adminSource: createPlatformAdminSource(rest, store),
    compliance: createPlatformComplianceSource(rest, store),
    store,
  };
}

const platform = createSources();

export let dataSource: BetNgDataSource = platform.dataSource;
export let adminSource: AdminDataSource = platform.adminSource;
export let compliance: ComplianceDataSource = platform.compliance;

adoptSession(platform.store);

let info: RuntimeInfo | undefined;

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

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

export function __setRuntimeForTests(sources: { readonly dataSource: BetNgDataSource; readonly adminSource: AdminDataSource; readonly compliance?: ComplianceDataSource }): void {
  dataSource = sources.dataSource;
  adminSource = sources.adminSource;
  if (sources.compliance !== undefined) compliance = sources.compliance;
  adoptSession(sources.adminSource.session);
}
