import { useRef } from "react";
import { formatMatchday, type MatchView } from "@betng/ui-core";
import { AnimatedScore, CommentaryFeed, ErrorPanel, Focusable, FootballIcon, GoalFlash, iconForEvent, LiveTag, MatchClock, MiniScoreboard, Skeleton, StatRow, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { useGoalFlash } from "../hooks/useGoalFlash";
import { useLiveMatches } from "../hooks/useLiveMatch";
import { useMatchAudio } from "../hooks/useMatchAudio";
import { buildFeed, headlineOf, isQuietWorthy, pickSpotlight, severityOf, type SpotlightScore } from "../lib/commentary";
import { cn } from "../lib/cn";
import { useDisplaySettings } from "../lib/displaySettings";
import { reads } from "../lib/reads";

function Spotlight({ match, score, quiet }: { readonly match: MatchView; readonly score: SpotlightScore; readonly quiet: boolean }): React.JSX.Element {
  const flash = useGoalFlash(match.id, match.score);
  const moments = match.events
    .filter((e) => e.side !== undefined && severityOf(e.kind) !== "minor" && (!quiet || isQuietWorthy(e.kind)))
    .slice(-4)
    .reverse();

  return (
    <section aria-label="Match of the moment" className="relative flex min-h-0 flex-col overflow-hidden border border-border bg-surface">
      <div className="flex items-center gap-[0.8rem] border-b border-border px-[1.4rem] py-[0.7rem]">
        <h2 className="font-display text-[1.2rem] font-black uppercase tracking-tight">Match of the moment</h2>
        <LiveTag phase={match.phase} />
        <span className="text-[0.95rem] font-semibold text-text-secondary">
          {match.leagueName} · {formatMatchday(match.matchday)}
        </span>
        <MatchClock match={match} realtime className="ml-auto text-[2rem]" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[2rem] px-[2rem] py-[1.4rem]">
        <div className="flex min-w-0 flex-col items-center gap-[0.5rem] text-center">
          <TeamMark team={match.home} size="hero" />
          <p className="w-full truncate font-display text-[2rem] font-black leading-none">{match.home.name}</p>
        </div>
        <p className="whitespace-nowrap font-display text-[7rem] font-black leading-none tracking-tighter">
          <AnimatedScore value={match.score.home} />
          <span className="mx-[0.15em] font-sans font-medium text-text-muted">–</span>
          <AnimatedScore value={match.score.away} />
        </p>
        <div className="flex min-w-0 flex-col items-center gap-[0.5rem] text-center">
          <TeamMark team={match.away} size="hero" />
          <p className="w-full truncate font-display text-[2rem] font-black leading-none">{match.away.name}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-[0.5rem] px-[1.4rem]">
        <span className="caps-label">Why</span>
        {score.reasons.length === 0 ? (
          <span className="text-[1rem] text-text-muted">The only match in play</span>
        ) : (
          score.reasons.map((r) => (
            <span key={r} className="rounded-xs border border-border-strong bg-surface-sunken px-[0.6rem] py-[0.15rem] text-[0.95rem] font-bold">
              {r}
            </span>
          ))
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-[1.4rem] px-[1.4rem] py-[1rem]">
        <ol aria-label="Key moments" className="space-y-[0.4rem]">
          {moments.map((e) => (
            <li key={e.id} className="grid grid-cols-[3rem_1.6rem_1fr_auto] items-center gap-[0.7rem] text-[1.05rem]">
              <span className="font-display font-black tabular text-text-muted">{e.minute}'</span>
              <FootballIcon name={iconForEvent(e.kind)} className="size-[1.5rem] text-text-secondary" />
              <span className="truncate">
                <span className="font-bold">{headlineOf(e.kind)}</span> · {e.player ?? e.description}
              </span>
              <span className="font-display font-black tabular">
                {e.score.home}–{e.score.away}
              </span>
            </li>
          ))}
        </ol>
        {match.stats !== undefined && (
          <div className="space-y-[0.5rem]">
            <StatRow label="Shots" home={match.stats.home.shots} away={match.stats.away.shots} />
            <StatRow label="On target" home={match.stats.home.shotsOnTarget} away={match.stats.away.shotsOnTarget} />
            <StatRow label="Corners" home={match.stats.home.corners} away={match.stats.away.corners} />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-[1.4rem] py-[0.7rem]">
        <p className="text-[0.85rem] text-text-muted">Chosen from the platform timeline: goals, red cards, late equalisers and recent goals. Nothing here forecasts what happens next.</p>
        <Focusable to={`/live/${match.id}`} autoFocusOnMount className="shrink-0 bg-brand px-[1.2rem] py-[0.5rem] text-[1.05rem] font-bold text-text-on-brand">
          Watch full screen
        </Focusable>
      </div>
      <GoalFlash flash={flash} home={match.home} away={match.away} score={match.score} />
    </section>
  );
}

export function FeedScreen(): React.JSX.Element {
  const [settings] = useDisplaySettings();
  const live = useAsync(() => reads.listMatches({ phases: ["LIVE", "HALFTIME"] }), [], 3000);
  const next = useAsync(() => reads.listMatches({ phases: ["BETTING_OPEN", "BETTING_CLOSED", "SCHEDULED"], limit: 3 }), [], 8000);
  const snapshots = useLiveMatches((live.data ?? []).map((m) => m.id));
  const views = [...snapshots.values()].flatMap((s) => (s.match === undefined ? [] : [s.match]));
  const current = useRef<string | undefined>(undefined);
  const spot = pickSpotlight(views, current.current);

  current.current = spot?.matchId;

  const spotMatch = views.find((m) => m.id === spot?.matchId);
  const feed = buildFeed(views, { quiet: settings.quietMode });

  useMatchAudio([spotMatch]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-[1rem]">
      {live.data === undefined && live.error !== undefined ? (
        <ErrorPanel title="Live matches could not be loaded" className="border border-border bg-surface" />
      ) : spotMatch !== undefined && spot !== undefined ? (
        <Spotlight match={spotMatch} score={spot} quiet={settings.quietMode} />
      ) : live.data !== undefined && live.data.length === 0 ? (
        <section aria-label="No match in play" className="flex flex-col items-center justify-center gap-[1rem] border border-border bg-surface px-[2rem]">
          <p className="font-display text-[2.2rem] font-bold">No match in play</p>
          <div className="w-full max-w-[36rem] space-y-[0.5rem]">
            {(next.data ?? []).map((m) => (
              <MiniScoreboard key={m.id} match={m} />
            ))}
          </div>
          <Focusable to="/upcoming" autoFocusOnMount className="border border-border-strong bg-surface-sunken px-[1.2rem] py-[0.5rem] text-[1.05rem] font-bold">
            All upcoming matches
          </Focusable>
        </section>
      ) : (
        <Skeleton className="h-full" />
      )}
      <section aria-label="Commentary" className="flex min-h-0 flex-col border border-border bg-surface">
        <div className="flex items-baseline justify-between border-b border-border px-[1.2rem] py-[0.6rem]">
          <h2 className="font-display text-[1.2rem] font-black uppercase tracking-tight">Live commentary</h2>
          <span className={cn("text-[0.85rem] font-semibold", settings.quietMode ? "text-warning" : "text-text-muted")}>{settings.quietMode ? "Quiet mode · major events only" : `${String(views.length)} matches`}</span>
        </div>
        {feed.length === 0 ? <p className="px-[1.2rem] py-[1rem] text-[1.05rem] text-text-muted">Entries appear as the platform reports them.</p> : <CommentaryFeed items={feed} className="flex-1 p-[0.6rem]" />}
      </section>
    </div>
  );
}
