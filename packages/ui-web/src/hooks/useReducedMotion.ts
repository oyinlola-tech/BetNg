import { useMediaQuery } from "./useMediaQuery";

/** True when the viewer asked the system for less motion. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
