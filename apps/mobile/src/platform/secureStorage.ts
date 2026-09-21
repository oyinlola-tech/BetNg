import type { SessionStorage } from "@betng/ui-core";

/** Encrypted, device-bound key-value storage (Keychain / Keystore). The only place a credential may be written. */
export interface SecureStorage {
  /** False when the value will not survive an app restart. */
  readonly persistent: boolean;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * expo-secure-store is not installed in this workspace, so credentials live in
 * memory only and the customer signs in again after a restart. AsyncStorage is
 * never used for credentials: it is not encrypted.
 */
export function createMemorySecureStorage(): SecureStorage {
  const values = new Map<string, string>();

  return {
    persistent: false,
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      values.set(key, value);

      return Promise.resolve();
    },
    removeItem: (key) => {
      values.delete(key);

      return Promise.resolve();
    },
  };
}

export interface SecureSessionStorage {
  readonly storage: Required<SessionStorage>;
  hydrate(keys: readonly string[]): Promise<void>;
}

/** The session stores are synchronous; secure storage is not. Known keys are read once at boot and writes go through. */
export function createSecureSessionStorage(secure: SecureStorage, onError: (operation: string) => void): SecureSessionStorage {
  const cache = new Map<string, string>();

  return {
    hydrate: async (keys) => {
      for (const key of keys) {
        try {
          const value = await secure.getItem(key);

          if (value !== null) cache.set(key, value);
        } catch {
          onError("read");
        }
      }
    },
    storage: {
      get: (key) => cache.get(key) ?? null,
      set: (key, value) => {
        cache.set(key, value);
        secure.setItem(key, value).catch(() => {
          onError("write");
        });
      },
      remove: (key) => {
        cache.delete(key);
        secure.removeItem(key).catch(() => {
          onError("remove");
        });
      },
    },
  };
}
