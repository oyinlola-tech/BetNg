import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function media(): MediaQueryList | undefined {
  return typeof window === "undefined" || typeof window.matchMedia !== "function" ? undefined : window.matchMedia(QUERY);
}

export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = media();

      list?.addEventListener("change", onChange);

      return () => {
        list?.removeEventListener("change", onChange);
      };
    },
    prefersReducedMotion,
    () => false,
  );
}
