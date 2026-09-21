import { Link } from "react-router";
import { ChevronRight, CloudOff } from "lucide-react";
import {
  clockProgress,
  displayClock,
  formatCountdown,
  formatKickoffTime,
  formatMatchday,
  isUpcoming,
  type DisplayClock,
  type MatchEventView,
  type MatchStats,
  type MatchSummary,
  type TeamView,
} from "@betng/ui-core";
import { PhaseBadge } from "../domain/PhaseBadge";
import { FootballIcon, eventTone } from "../icons";
import { cn } from "../lib/cn";
import { TeamCrest } from "../teams";
import { MatchCardError } from "./MatchCardError";
import { MatchCardSkeleton } from "./MatchCardSkeleton";
import { ScoreValue } from "./ScoreValue";
import { StatComparison } from "./StatComparison";
import {
  MATCH_CARD_VARIANTS,
  type MatchCardVariant,
  type MatchCardVariantSpec,
} from "./matchCardVariants";
import {
  STATE_WORD,
  matchAccessibleName,
  matchOutcome,
  showsScore,
} from "./matchState";
import { statRows } from "./statRows";
import { useMatchNow } from "./useMatchNow";

const COUNTDOWN_WINDOW_MS = 60 * 60 * 1000;
const CARD_STATS = ["possession", "shots", "shotsOnTarget"] as const;

export interface MatchCardProps {
  readonly match: MatchSummary;
  readonly variant?: MatchCardVariant;
  /** Makes the card a link. Without it the card is a non-interactive article. */
  readonly to?: string | undefined;
  readonly now?: number | undefined;
  readonly lastEvent?: MatchEventView | undefined;
  readonly stats?: MatchStats | undefined;
  /** A market summary the app supplies, e.g. a match-result row. Rendered outside the link. */
  readonly markets?: React.ReactNode;
  readonly stale?: boolean;
  readonly showCompetition?: boolean;
  readonly className?: string | undefined;
}

export function MatchCard({
  match,
  variant = "standard",
  to,
  now,
  lastEvent,
  stats,
  markets,
  stale = false,
  showCompetition = true,
  className,
}: MatchCardProps): React.JSX.Element {
  const spec = MATCH_CARD_VARIANTS[variant];
  const upcoming = isUpcoming(match.phase);
  const current = useMatchNow(
    !stale && (match.phase === "LIVE" || upcoming),
    now,
  );
  // A stale card holds the last minute the platform reported instead of advancing it.
  const clock = displayClock(
    match.clock,
    stale && match.clock !== undefined ? Date.parse(match.clock.asOf) : current,
  );
  const name = matchAccessibleName(match, clock);
  const row = spec.layout === "row";

  const body = (
    <>
      {row ? (
        <RowState
          match={match}
          clock={clock}
          now={current}
          stale={stale}
          showCompetition={showCompetition}
        />
      ) : (
        <StackHeader
          match={match}
          clock={clock}
          now={current}
          stale={stale}
          spec={spec}
          showCompetition={showCompetition}
        />
      )}
      <div className="min-w-0">
        <Teams match={match} spec={spec} />
        {match.statusReason !== undefined && (
          <p className="type-small mt-1.5 text-text-secondary">
            {match.statusReason}
          </p>
        )}
        {lastEvent !== undefined && !upcoming && (
          <LastEvent event={lastEvent} match={match} />
        )}
        {variant === "live" && stats !== undefined && (
          <KeyStats stats={stats} />
        )}
      </div>
      {row && to !== undefined && (
        <ChevronRight
          className="size-4 shrink-0 self-center text-text-muted transition-transform duration-[var(--bn-duration-fast)] group-hover:translate-x-0.5"
          aria-hidden
        />
      )}
    </>
  );

  const mainClass = cn(
    spec.main,
    "min-w-0",
    row
      ? "grid flex-1 grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-3"
      : "block",
  );

  return (
    <article
      aria-label={to === undefined ? name : undefined}
      data-phase={match.phase}
      className={cn(
        "group relative",
        spec.root,
        row && "flex items-stretch",
        to !== undefined &&
          (row
            ? "transition-colors duration-[var(--bn-duration-fast)] hover:bg-surface-hover"
            : "transition-colors duration-[var(--bn-duration-fast)] hover:border-border-strong"),
        className,
      )}
    >
      {to === undefined ? (
        <div className={mainClass}>{body}</div>
      ) : (
        <Link
          to={to}
          aria-label={name}
          className={cn(mainClass, "rounded-[inherit] focus-ring")}
        >
          {body}
        </Link>
      )}
      {markets !== undefined && markets !== null && (
        <div className={cn(spec.markets, row && "flex shrink-0 items-center")}>
          {markets}
        </div>
      )}
      {variant === "live" && clock !== undefined && (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-md bg-surface-sunken"
        >
          <div
            className="h-full bg-live transition-[width] duration-[var(--bn-duration-slow)] ease-linear"
            style={{ width: `${String(clockProgress(clock) * 100)}%` }}
          />
        </div>
      )}
    </article>
  );
}

MatchCard.Skeleton = MatchCardSkeleton;
MatchCard.Error = MatchCardError;

interface StateProps {
  readonly match: MatchSummary;
  readonly clock: DisplayClock | undefined;
  readonly now: number;
  readonly stale: boolean;
  readonly showCompetition: boolean;
}

function kickoffText(match: MatchSummary, now: number): string {
  const remaining = Date.parse(match.kickoffAt) - now;
  const time = formatKickoffTime(match.kickoffAt);

  return remaining > 0 && remaining < COUNTDOWN_WINDOW_MS
    ? `${time} · in ${formatCountdown(remaining)}`
    : time;
}

function StaleMark(): React.JSX.Element {
  return (
    <span
      className="type-caption inline-flex items-center gap-1 text-warning"
      title="Showing the last update received"
    >
      <CloudOff className="size-3" aria-hidden />
      Stale
    </span>
  );
}

function RowState({
  match,
  clock,
  now,
  stale,
  showCompetition,
}: StateProps): React.JSX.Element {
  const upcoming = isUpcoming(match.phase);

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <PhaseBadge phase={match.phase} clock={clock?.label} />
      <span className="type-small tabular w-full truncate text-text-muted">
        {showCompetition && `${match.leagueCode} `}
        {upcoming
          ? kickoffText(match, now)
          : !showCompetition && formatKickoffTime(match.kickoffAt)}
      </span>
      {stale && <StaleMark />}
    </div>
  );
}

function StackHeader({
  match,
  clock,
  now,
  stale,
  spec,
  showCompetition,
}: StateProps & { readonly spec: MatchCardVariantSpec }): React.JSX.Element {
  const live = match.phase === "LIVE";

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="type-caption min-w-0 truncate">
        {showCompetition && `${match.leagueName} · `}
        {formatMatchday(match.matchday)}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {stale && <StaleMark />}
        {isUpcoming(match.phase) && (
          <span className="type-data text-text-secondary">
            {kickoffText(match, now)}
          </span>
        )}
        <PhaseBadge
          phase={match.phase}
          label={live ? undefined : STATE_WORD[match.phase]}
          clock={clock?.label}
          solid={live}
          size={spec.badge}
        />
      </div>
    </div>
  );
}

function Teams({
  match,
  spec,
}: {
  readonly match: MatchSummary;
  readonly spec: MatchCardVariantSpec;
}): React.JSX.Element {
  const outcome = matchOutcome(match);
  const scored = showsScore(match);

  return (
    <div className={spec.teamGap}>
      <TeamLine
        team={match.home}
        score={scored ? match.score.home : undefined}
        dimmed={outcome === "AWAY"}
        emphasised={outcome === "HOME"}
        spec={spec}
      />
      <TeamLine
        team={match.away}
        score={scored ? match.score.away : undefined}
        dimmed={outcome === "HOME"}
        emphasised={outcome === "AWAY"}
        spec={spec}
      />
    </div>
  );
}

function TeamLine({
  team,
  score,
  dimmed,
  emphasised,
  spec,
}: {
  readonly team: TeamView;
  readonly score: number | undefined;
  readonly dimmed: boolean;
  readonly emphasised: boolean;
  readonly spec: MatchCardVariantSpec;
}): React.JSX.Element {
  const colour = dimmed ? "text-text-secondary" : "text-text-primary";

  return (
    <div className="flex items-center gap-2" data-winner={emphasised || undefined}>
      <TeamCrest team={team} size={spec.crest} decorative />
      <span
        className={cn(
          spec.name,
          "min-w-0 flex-1 truncate",
          colour,
          emphasised ? "font-bold" : "font-medium",
        )}
      >
        {team.name}
      </span>
      {score !== undefined && (
        <ScoreValue
          value={score}
          className={cn(spec.score, "min-w-[1ch] text-right", colour)}
        />
      )}
    </div>
  );
}

function LastEvent({
  event,
  match,
}: {
  readonly event: MatchEventView;
  readonly match: MatchSummary;
}): React.JSX.Element {
  const team =
    event.side === undefined
      ? undefined
      : event.side === "HOME"
        ? match.home
        : match.away;

  return (
    <p
      key={event.id}
      className="type-small mt-2 flex items-center gap-1.5 text-text-secondary animate-event-in"
    >
      <FootballIcon
        kind={event.kind}
        size={14}
        className={cn("shrink-0", eventTone(event.kind))}
      />
      <span className="tabular text-text-muted">{event.minute}&apos;</span>
      <span className="min-w-0 truncate">
        {event.player ?? event.description}
        {team !== undefined && event.player !== undefined && (
          <span className="text-text-muted"> · {team.code}</span>
        )}
      </span>
    </p>
  );
}

function KeyStats({
  stats,
}: {
  readonly stats: MatchStats;
}): React.JSX.Element | null {
  const rows = statRows(stats, CARD_STATS);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-2">
      {rows.map((row) => (
        <StatComparison
          key={row.key}
          label={row.label}
          home={row.home}
          away={row.away}
          unit={row.unit}
          dense
        />
      ))}
    </div>
  );
}
