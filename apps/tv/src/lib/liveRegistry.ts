import type { MatchId } from "@betng/contracts";
import { watchMatch, type BetNgDataSource, type LiveMatchController } from "@betng/ui-core";
import { dataSource } from "../services/dataSource";

export interface LiveRegistry {
  readonly acquire: (matchId: string) => { readonly controller: LiveMatchController; readonly release: () => void };
  readonly size: () => number;
}

/* Every view of the same match shares one watcher, and the display's one data source carries them all on its single realtime connection. A release lingers briefly so a route change does not drop and re-open the channel. */
export function createLiveRegistry(
  source: () => BetNgDataSource,
  options: { readonly lingerMs?: number; readonly watch?: typeof watchMatch } = {},
): LiveRegistry {
  const lingerMs = options.lingerMs ?? 4000;
  const watch = options.watch ?? watchMatch;
  const entries = new Map<string, { controller: LiveMatchController; count: number; timer: ReturnType<typeof setTimeout> | undefined }>();

  return {
    acquire: (matchId) => {
      let entry = entries.get(matchId);

      if (entry === undefined) {
        entry = { controller: watch(source(), matchId as MatchId), count: 0, timer: undefined };
        entries.set(matchId, entry);
      }
      if (entry.timer !== undefined) clearTimeout(entry.timer);
      entry.timer = undefined;
      entry.count += 1;

      const held = entry;
      let released = false;

      return {
        controller: held.controller,
        release: () => {
          if (released) return;
          released = true;
          held.count -= 1;
          if (held.count > 0) return;

          const stop = (): void => {
            if (held.count > 0 || entries.get(matchId) !== held) return;
            held.controller.stop();
            entries.delete(matchId);
          };

          if (lingerMs <= 0) stop();
          else held.timer = setTimeout(stop, lingerMs);
        },
      };
    },
    size: () => entries.size,
  };
}

export const liveRegistry = createLiveRegistry(() => dataSource);
