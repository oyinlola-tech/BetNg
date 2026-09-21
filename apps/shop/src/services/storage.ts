import type { SessionStorage } from "@betng/ui-core";

function webStorage(pick: () => Storage): Required<SessionStorage> {
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

export const local = webStorage(() => localStorage);
/* A cashier session ends with the tab; the token is never written to localStorage. */
export const perTab = webStorage(() => sessionStorage);
