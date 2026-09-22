import { useEffect, useRef, useState } from "react";
import type { Score } from "@betng/ui-core";
import { scoringSide, type Side } from "../lib/multiview";

export const GOAL_FLASH_MS = 3000;

export interface GoalFlash {
  readonly side: Side;
  readonly key: number;
}

/* Fires when the platform's score for the same match goes up; the first score seen, a correction down or another match never does. */
export function useGoalFlash(matchId: string | undefined, score: Score | undefined, durationMs: number = GOAL_FLASH_MS): GoalFlash | undefined {
  const last = useRef<{ readonly id: string | undefined; readonly score: Score | undefined }>({ id: undefined, score: undefined });
  const serial = useRef(0);
  const [flash, setFlash] = useState<GoalFlash | undefined>(undefined);
  const home = score?.home;
  const away = score?.away;

  useEffect(() => {
    const previous = last.current;
    const next = home === undefined || away === undefined ? undefined : { home, away };

    last.current = { id: matchId, score: next };

    if (next === undefined || previous.id !== matchId) {
      if (previous.id !== matchId) setFlash(undefined);

      return;
    }

    const side = scoringSide(previous.score, next);

    if (side === undefined) return;

    serial.current += 1;
    setFlash({ side, key: serial.current });
  }, [matchId, home, away]);

  useEffect(() => {
    if (flash === undefined) return;

    const timer = setTimeout(() => {
      setFlash((f) => (f?.key === flash.key ? undefined : f));
    }, durationMs);

    return () => {
      clearTimeout(timer);
    };
  }, [flash, durationMs]);

  return flash;
}
