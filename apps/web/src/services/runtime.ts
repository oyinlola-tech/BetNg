import type { CustomerSession } from "@betng/contracts";
import {
  COOKIE_SESSION_TOKEN,
  configureCurrency,
  createPlatformAccountServices,
  withoutCredential,
  configureDateTime,
  createPlatformAuthSource,
  createPlatformClients,
  createPlatformDataSource,
  createSessionStore,
  currentCurrency,
  resolveFlags,
  type AccountServicesSource,
  type AuthDataSource,
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

const SESSION_KEY = "betng.session.customer";

let activeSession: SessionStore<CustomerSession> = createSessionStore<CustomerSession>(SESSION_KEY);
let detachSession: (() => void) | undefined;
const sessionListeners = new Set<() => void>();

function notifySession(): void {
  for (const listener of sessionListeners) listener();
}

function adoptSession(store: SessionStore<CustomerSession>): void {
  detachSession?.();
  activeSession = store;
  detachSession = store.subscribe(notifySession);
  notifySession();
}

/* One stable store for the app; the source that owns the real one is adopted at start-up. */
export const session: SessionStore<CustomerSession> = {
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
export let authSource: AuthDataSource = pending as AuthDataSource;
export let accountServices: AccountServicesSource = pending as AccountServicesSource;

let info: RuntimeInfo | undefined;
let configRead: PlatformConfigView | undefined;

async function createSources(): Promise<void> {
  if (env.dataSource === "mock" && (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "test")) {
    const { createMockSources } = await import("./mockSources");
    const mock = createMockSources({ session: sessionStorageAdapter, local: localStorageAdapter });

    dataSource = mock.dataSource;
    authSource = mock.authSource;
    accountServices = mock.accountServices;
    adoptSession(mock.authSource.session);

    return;
  }

  const cookieSession = env.authTransport === "cookie";
  const store = createSessionStore<CustomerSession>(SESSION_KEY, cookieSession ? withoutCredential(sessionStorageAdapter) : sessionStorageAdapter);
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

  dataSource = createPlatformDataSource({
    rest,
    realtime,
    userId: () => store.snapshot().session?.user.id,
    storage: localStorageAdapter,
  });
  authSource = createPlatformAuthSource(rest, store);
  accountServices = createPlatformAccountServices(rest, store, { uploadHosts: env.uploadHosts });
  adoptSession(store);
}

export async function initRuntime(): Promise<RuntimeInfo> {
  if (info !== undefined) return info;

  for (const problem of env.problems) logger.warn("flow", problem);

  await createSources();

  try {
    configRead = await dataSource.getPlatformConfig();
    configureCurrency(configRead.currency);
    configureDateTime(
      configRead.competitionTimezone === undefined ? {} : { competitionTimeZone: configRead.competitionTimezone },
    );
  } catch {
    logger.warn("flow", "Platform configuration could not be read; defaults are in use.");
  }

  info = {
    flags: resolveFlags(configRead?.features, env.flagOverrides),
    config: configRead ?? { currency: currentCurrency(), features: {} },
  };

  return info;
}

export function getRuntimeConfig(): PlatformConfigView | undefined {
  return configRead;
}

export function __setRuntimeForTests(sources: {
  readonly dataSource: BetNgDataSource;
  readonly authSource: AuthDataSource;
  readonly accountServices?: AccountServicesSource;
}): void {
  dataSource = sources.dataSource;
  authSource = sources.authSource;
  if (sources.accountServices !== undefined) accountServices = sources.accountServices;
  adoptSession(sources.authSource.session);
}
