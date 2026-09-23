import { useEffect, useRef, useState } from "react";
import {
  createAnimationQueue,
  type AnimationQueue,
  type PresentationEvent,
} from "@betng/ui-core";
import { useReducedMotion } from "../../hooks/useReducedMotion";

/*
 * Drives one match's animation queue from the event stream. The stream is the
 * authority; this hook only decides which of its events is on screen now, so
 * that six events arriving in one resync are watched one at a time instead of
 * flashing past together.
 *
 * The queue is kept in a ref and fed on every change, which means a new ball
 * position re-renders the stadium and nothing else in the page.
 */

export interface MatchAnimation {
  /** The event on screen, or nothing during ordinary play. */
  readonly playing: PresentationEvent | undefined;
  readonly pending: number;
  readonly reducedMotion: boolean;
}

export function useMatchAnimation(
  events: readonly PresentationEvent[],
  enabled = true,
): MatchAnimation {
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState<PresentationEvent | undefined>(
    undefined,
  );
  const [pending, setPending] = useState(0);
  const queueRef = useRef<AnimationQueue | undefined>(undefined);
  const latest = useRef(events);

  latest.current = events;

  useEffect(() => {
    const queue = createAnimationQueue({
      reducedMotion,
      onPlay: (event) => {
        setPlaying(event);
      },
    });

    /*
     * Everything already in the stream when the stadium opens has happened
     * ahead of the viewer: it belongs in the timeline, not in the animation
     * queue. Only what arrives from here is played.
     */
    queue.seed(latest.current);
    queueRef.current = queue;

    return () => {
      queue.stop();
      queueRef.current = undefined;
      setPlaying(undefined);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!enabled) return;

    const queue = queueRef.current;

    if (queue === undefined) return;

    queue.push(events);
    setPending(queue.pending());
  }, [events, enabled]);

  return { playing, pending, reducedMotion };
}
