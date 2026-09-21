import type { KeyValueStorage } from "@betng/ui-core";

export const storage: KeyValueStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  },
};
