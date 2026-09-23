import { useSyncExternalStore } from "react";

/*
 * Terminals arrive on whatever hardware a shop already owns: a 1024x600
 * netbook, a 1366x768 laptop, a 27-inch counter monitor. The deciding factor
 * is how much vertical room is left after the browser's own chrome, which is
 * why this reads the viewport rather than a screen size — two 12-inch displays
 * can report very different resolutions, and browser zoom changes the answer
 * again on the same machine.
 *
 * Density never removes a control. It tightens spacing and type so that the
 * match list, the markets and the slip all stay on one screen without the page
 * itself scrolling.
 */

export type TerminalDensity = "NORMAL" | "COMPACT" | "ULTRA_COMPACT";

/** Below this the workspace cannot hold a comfortable market grid and its slip. */
const COMPACT_HEIGHT = 820;
const ULTRA_HEIGHT = 680;
/** A narrow viewport costs the three-column layout before it costs height. */
const COMPACT_WIDTH = 1280;

export function densityFor(width: number, height: number): TerminalDensity {
  if (height <= ULTRA_HEIGHT) return "ULTRA_COMPACT";
  if (height <= COMPACT_HEIGHT || width <= COMPACT_WIDTH) return "COMPACT";

  return "NORMAL";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);

  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}

/*
 * One subscription for the whole terminal. Every panel reads the result through
 * the data-density attribute on the shell rather than mounting its own
 * listener, so resizing costs one render instead of one per panel.
 */
export function useTerminalDensity(): TerminalDensity {
  return useSyncExternalStore(
    subscribe,
    () => densityFor(window.innerWidth, window.innerHeight),
    () => "NORMAL" as const,
  );
}
