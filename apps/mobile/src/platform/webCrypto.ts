import { getRandomValues, randomUUID } from "expo-crypto";

/* The shared client names `crypto.randomUUID()` on every request and a device has no global `crypto`.
   This installs the operating system's secure source under that name, and leaves one that exists alone. */
const scope = globalThis as { crypto?: { getRandomValues?: unknown; randomUUID?: unknown } };

if (typeof scope.crypto?.getRandomValues !== "function" || typeof scope.crypto.randomUUID !== "function") {
  scope.crypto = { ...scope.crypto, getRandomValues, randomUUID };
}
