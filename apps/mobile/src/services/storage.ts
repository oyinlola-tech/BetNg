import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStorage } from "@betng/ui-core";

const PREFIX = "betng.";
const cache = new Map<string, string>();

/* AsyncStorage is asynchronous; the data sources need a synchronous store. Every BetNG key is
   read once at boot into memory, and writes go to memory first and to disk in the background. */
export async function hydrateStorage(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
    k.startsWith(PREFIX),
  );
  const pairs = await AsyncStorage.multiGet(keys);

  for (const [key, value] of pairs) if (value !== null) cache.set(key, value);
}

export const storage: KeyValueStorage = {
  get: (key) => cache.get(key) ?? null,
  set: (key, value) => {
    cache.set(key, value);
    void AsyncStorage.setItem(key, value);
  },
};

export function removeStored(key: string): void {
  cache.delete(key);
  void AsyncStorage.removeItem(key);
}
