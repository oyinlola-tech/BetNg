import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);

      media.addEventListener("change", onChange);

      return () => {
        media.removeEventListener("change", onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = (): boolean => useMediaQuery("(min-width: 1280px)");
export const useIsCompact = (): boolean => useMediaQuery("(max-width: 767px)");
