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

/* The admin token lives for the tab only; closing it signs the operator out. */
export const sessionStorageAdapter = adapter(() => window.sessionStorage);

/* Theme and layout preferences only. Nothing sensitive is written here. */
export const localStorageAdapter = adapter(() => window.localStorage);
