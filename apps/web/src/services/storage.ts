import type { SessionStorage } from "@betng/ui-core";

function adapter(pick: () => Storage): Required<SessionStorage> {
  return {
    get: (key) => {
      try {
        return pick().getItem(key);
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        pick().setItem(key, value);
      } catch {
        return;
      }
    },
    remove: (key) => {
      try {
        pick().removeItem(key);
      } catch {
        return;
      }
    },
  };
}

export const sessionStorageAdapter = adapter(() => window.sessionStorage);

/* UI preferences and viewed matches only. Nothing sensitive is written here. */
export const localStorageAdapter = adapter(() => window.localStorage);
