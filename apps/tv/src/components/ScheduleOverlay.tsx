import { useEffect } from "react";
import { formatKickoffTime, formatShortDate } from "@betng/ui-core";
import { useAsync } from "../hooks/useAsync";
import { useNow } from "../hooks/useNow";
import { withinNextDay } from "../lib/fixtures";
import { follows, useFavourites } from "../lib/favourites";
import { reads } from "../lib/reads";
import { Countdown } from "./Countdown";
import { FavouriteMark } from "./FavouriteMark";
import { TeamMark } from "./TeamMark";
import { VirtualList } from "./VirtualList";

const CLOSE_KEYS = new Set(["Escape", "Backspace", "GoBack", "BrowserBack"]);
const HELD_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"]);

/* Next 24 hours from the platform's kick-off times. Modal but not focusable: the remote's focus stays where it was underneath. */
export function ScheduleOverlay({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const now = useNow(30_000);
  const favourites = useFavourites();
  const upcoming = useAsync(() => reads.listMatches({ phases: ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED"] }), [], 30_000);
  const day = withinNextDay(upcoming.data ?? [], now);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (CLOSE_KEYS.has(event.key)) {
        event.preventDefault();
        onClose();
      } else if (HELD_KEYS.has(event.key)) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Schedule for the next 24 hours" className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-[3rem]">
      <div className="flex h-full w-full max-w-[64rem] flex-col border border-border-strong bg-surface-elevated shadow-lg animate-fade-in">
        <div className="flex items-baseline justify-between border-b border-border px-[1.6rem] py-[0.9rem]">
          <h2 className="font-display text-[1.8rem] font-black tracking-tight">Next 24 hours</h2>
          <p className="text-[0.95rem] text-text-muted">{day.length} kick-offs · Info or Back to close</p>
        </div>
        {upcoming.data === undefined ? (
          <p className="px-[1.6rem] py-[1.2rem] text-[1.1rem] text-text-muted">{upcoming.error === undefined ? "Loading the schedule…" : "The schedule could not be loaded."}</p>
        ) : day.length === 0 ? (
          <p className="px-[1.6rem] py-[1.2rem] text-[1.1rem] text-text-muted">Nothing is scheduled in the next 24 hours.</p>
        ) : (
          <VirtualList
            label="Kick-offs"
            items={day}
            keyOf={(m) => m.id}
            heightOf={() => 3.2}
            className="flex-1 px-[1rem] py-[0.6rem]"
            render={(m) => (
              <div className="grid h-full grid-cols-[6rem_5rem_4rem_1fr_7rem] items-center gap-[1rem] border-b border-border px-[0.6rem] text-[1.1rem]">
                <span className="font-display font-black tabular">{formatKickoffTime(m.kickoffAt)}</span>
                <span className="text-[0.85rem] text-text-muted">{formatShortDate(m.kickoffAt)}</span>
                <span className="text-[0.85rem] font-bold uppercase tracking-caps text-text-muted">{m.leagueCode}</span>
                <span className="flex min-w-0 items-center gap-[0.6rem] font-semibold">
                  <TeamMark team={m.home} size="sm" />
                  <span className="truncate">
                    {m.home.name} <span className="text-text-muted">v</span> {m.away.name}
                  </span>
                  <TeamMark team={m.away} size="sm" />
                  {follows(favourites, m.home.id, m.away.id) && <FavouriteMark />}
                </span>
                <Countdown to={m.kickoffAt} className="text-right font-display font-black" />
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
