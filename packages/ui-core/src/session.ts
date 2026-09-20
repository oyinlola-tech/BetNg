/** One signed-in identity per app (customer, cashier or admin), persisted through the app's storage and observable by the UI. */

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

export interface SessionStore<S extends SessionLike> {
  snapshot(): SessionSnapshot<S>;
  token(): string | undefined;
  set(session: S): void;
  /** The user signed out. */
  clear(): void;
  /** The platform rejected the token or it ran out; the UI asks the user to sign in again and keeps their place. */
  expire(): void;
  subscribe(listener: () => void): () => void;
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
