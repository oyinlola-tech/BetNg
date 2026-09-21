export type SessionStatus = "ANONYMOUS" | "AUTHENTICATED" | "EXPIRED";

export interface SessionLike {
  readonly token: string;
  readonly expiresAt: string;
}

export interface SessionStorage {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
  remove?(key: string): void;
}

export interface SessionSnapshot<S> {
  readonly status: SessionStatus;
  readonly session: S | undefined;
}

/** Function-typed properties, not methods: every member is a closure, so it is safe to pass one around on its own (e.g. to `useSyncExternalStore`). */
export interface SessionStore<S extends SessionLike> {
  readonly snapshot: () => SessionSnapshot<S>;
  readonly token: () => string | undefined;
  readonly set: (session: S) => void;
  readonly clear: () => void;
  /** The platform rejected the token or it ran out; the UI asks the user to sign in again and keeps their place. */
  readonly expire: () => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createSessionStore<S extends SessionLike>(key: string, storage?: SessionStorage, now: () => number = Date.now): SessionStore<S> {
  const listeners = new Set<() => void>();
  let state: SessionSnapshot<S> = { status: "ANONYMOUS", session: undefined };
  let timer: ReturnType<typeof setTimeout> | undefined;

  const persist = (session: S | undefined): void => {
    if (storage === undefined) return;
    if (session !== undefined) storage.set(key, JSON.stringify(session));
    else if (storage.remove !== undefined) storage.remove(key);
    else storage.set(key, "");
  };

  const apply = (next: SessionSnapshot<S>): void => {
    state = next;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;

    if (next.status === "AUTHENTICATED" && next.session !== undefined) {
      const remaining = Date.parse(next.session.expiresAt) - now();

      timer = setTimeout(() => {
        store.expire();
      }, Math.min(Math.max(remaining, 0), 2_000_000_000));
    }

    for (const listener of listeners) listener();
  };

  const store: SessionStore<S> = {
    snapshot: () => state,
    token: () => (state.status === "AUTHENTICATED" ? state.session?.token : undefined),
    set: (session) => {
      persist(session);
      apply({ status: "AUTHENTICATED", session });
    },
    clear: () => {
      persist(undefined);
      apply({ status: "ANONYMOUS", session: undefined });
    },
    expire: () => {
      if (state.status !== "AUTHENTICATED") return;
      persist(undefined);
      apply({ status: "EXPIRED", session: state.session });
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  try {
    const raw = storage?.get(key);

    if (typeof raw === "string" && raw !== "") {
      const saved = JSON.parse(raw) as S;

      if (typeof saved.token === "string" && Date.parse(saved.expiresAt) > now()) apply({ status: "AUTHENTICATED", session: saved });
      else persist(undefined);
    }
  } catch {
    persist(undefined);
  }

  return store;
}

/** Whether a platform-resolved permission list allows an action. The platform still enforces it; this only decides what to render. */
export function hasPermission(permissions: readonly string[] | undefined, permission: string): boolean {
  return permissions?.includes(permission) ?? false;
}

export const COOKIE_SESSION_TOKEN = "cookie-session";

/** For cookie sessions: persists who is signed in and until when, never a credential. The browser holds the HttpOnly cookie. */
export function withoutCredential(storage: SessionStorage): SessionStorage {
  return {
    get: (key) => storage.get(key),
    set: (key, value) => {
      try {
        const parsed = JSON.parse(value) as Record<string, unknown>;

        storage.set(key, JSON.stringify({ ...parsed, token: COOKIE_SESSION_TOKEN }));
      } catch {
        storage.set(key, "");
      }
    },
    ...(storage.remove === undefined ? {} : { remove: (key: string) => storage.remove?.(key) }),
  };
}
