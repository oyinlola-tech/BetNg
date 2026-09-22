import { useEffect, useRef } from "react";
import type { MatchView } from "@betng/ui-core";
import { crowdIntensity, cueFor, soundEngine } from "../lib/audio";
import { useDisplaySettings } from "../lib/displaySettings";

/* Sounds follow new platform events on the matches on screen; history already on the timeline when a match is first seen stays silent. */
export function useMatchAudio(matches: readonly (MatchView | undefined)[]): void {
  const [settings] = useDisplaySettings();
  const seen = useRef(new Map<string, number>());
  const present = matches.filter((m): m is MatchView => m !== undefined);
  const signature = present.map((m) => `${m.id}:${String(m.events.length)}:${String(m.events.at(-1)?.sequence ?? 0)}`).join("|");
  const latest = useRef(present);

  latest.current = present;

  useEffect(() => {
    let level = 0;
    const cues = new Set<ReturnType<typeof cueFor>>();

    for (const match of latest.current) {
      const last = match.events.reduce((max, e) => Math.max(max, e.sequence), 0);
      const before = seen.current.get(match.id);

      seen.current.set(match.id, last);
      level = Math.max(level, crowdIntensity(match.events));
      if (before === undefined) continue;
      for (const e of match.events) if (e.sequence > before) cues.add(cueFor(e, settings.quietMode));
    }

    soundEngine.setIntensity(level);
    if (!settings.audioEnabled) return;
    if (cues.has("goal")) soundEngine.play("goal");
    else if (cues.has("final-whistle")) soundEngine.play("final-whistle");
    else if (cues.has("whistle")) soundEngine.play("whistle");
  }, [signature, settings.audioEnabled, settings.quietMode]);
}
