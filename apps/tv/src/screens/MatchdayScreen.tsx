import {
  formatMatchday,
  isFinished,
  isInPlay,
  displayClock,
  type MatchSummary,
} from "@betng/ui-core";
import {
  Countdown,
  Focusable,
  LiveTag,
  Skeleton,
  TeamMark,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { reads } from "../lib/reads";

function Row({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  const now = useNow(1000);
  const live = isInPlay(match.phase);
  const done = isFinished(match.phase);

  return (
    <Focusable
      to={`/live/${match.id}`}
      className="grid w-full grid-cols-[6rem_1fr_auto_1fr_7rem] items-center gap-[1rem] border border-border bg-surface px-[1.2rem] py-[0.7rem] text-left"
    >
      <LiveTag phase={match.phase} />
      <span className="flex items-center justify-end gap-[0.7rem] text-right text-[1.2rem] font-bold">
        <span className="truncate">{match.home.name}</span>
        <TeamMark team={match.home} size="sm" />
      </span>
      <span
        className={cn(
          "min-w-[5rem] rounded-xs px-[0.6rem] py-[0.1rem] text-center font-display text-[1.5rem] font-black tabular",
          live || done ? "bg-surface-sunken" : "text-text-muted",
        )}
      >
        {live || done
          ? `${String(match.score.home)}–${String(match.score.away)}`
          : "v"}
      </span>
      <span className="flex items-center gap-[0.7rem] text-[1.2rem] font-bold">
        <TeamMark team={match.away} size="sm" />
        <span className="truncate">{match.away.name}</span>
      </span>
      <span
        className={cn(
          "text-right font-display text-[1.2rem] font-black tabular",
          live ? "text-live" : "text-text-muted",
        )}
      >
        {live ? (
          (displayClock(match.clock, now)?.label ?? "LIVE")
        ) : done ? (
          "FT"
        ) : (
          <Countdown to={match.kickoffAt} />
        )}
      </span>
    </Focusable>
  );
}

export function MatchdayScreen(): React.JSX.Element {
  const matches = useAsync(
    () =>
      reads.listMatches({
        phases: [
          "LIVE",
          "HALFTIME",
          "BETTING_OPEN",
          "BETTING_CLOSED",
          "FINISHED",
          "SETTLED",
        ],
      }),
    [],
    4000,
  );

  const groups = new Map<string, MatchSummary[]>();

  for (const m of matches.data ?? []) {
    const key = `${m.leagueName} · ${formatMatchday(m.matchday)}`;

    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return (
    <div className="flex h-full flex-col">
      <p className="caps-label">Today</p>
      <h1 className="font-display text-[2.4rem] font-black tracking-tight">
        Matchday
      </h1>
      <div className="mt-[1rem] min-h-0 flex-1 space-y-[1.2rem] overflow-y-auto pr-[0.5rem]">
        {matches.data === undefined
          ? Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[3.4rem]" />
            ))
          : [...groups.entries()].slice(0, 4).map(([label, items]) => (
              <section key={label} aria-label={label}>
                <h2 className="caps-label mb-[0.5rem] text-text-secondary">
                  {label}
                </h2>
                <div className="space-y-[0.5rem]">
                  {items.map((m) => (
                    <Row key={m.id} match={m} />
                  ))}
                </div>
              </section>
            ))}
      </div>
    </div>
  );
}
