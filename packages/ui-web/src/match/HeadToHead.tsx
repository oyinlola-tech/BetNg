import { Link } from "react-router";
import {
  formatShortDate,
  type HeadToHeadMeeting,
  type HeadToHeadView,
  type TeamView,
} from "@betng/ui-core";
import { cn } from "../lib/cn";
import { TeamCrest } from "../teams";
import { EmptyState, Skeleton } from "../ui";

export interface HeadToHeadProps {
  readonly headToHead: HeadToHeadView | undefined;
  readonly home: TeamView;
  readonly away: TeamView;
  readonly loading?: boolean;
  /** Makes each meeting a link. */
  readonly meetingHref?: ((meeting: HeadToHeadMeeting) => string) | undefined;
  readonly limit?: number | undefined;
  readonly className?: string | undefined;
}

export function HeadToHead({
  headToHead,
  home,
  away,
  loading = false,
  meetingHref,
  limit,
  className,
}: HeadToHeadProps): React.JSX.Element {
  if (loading) {
    return (
      <div
        role="status"
        aria-busy
        aria-label="Loading head to head"
        className={cn("space-y-3", className)}
      >
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (headToHead === undefined || headToHead.played === 0) {
    return (
      <EmptyState
        compact
        title="No previous meetings"
        description={`${home.name} and ${away.name} have not met before.`}
        className={className}
      />
    );
  }

  const meetings =
    limit === undefined
      ? headToHead.meetings
      : headToHead.meetings.slice(0, limit);

  return (
    <section aria-label="Head to head" className={className}>
      <SummaryBar headToHead={headToHead} home={home} away={away} />
      {meetings.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {meetings.map((meeting) => (
            <li key={meeting.matchId}>
              <Meeting meeting={meeting} href={meetingHref?.(meeting)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryBar({
  headToHead,
  home,
  away,
}: {
  readonly headToHead: HeadToHeadView;
  readonly home: TeamView;
  readonly away: TeamView;
}): React.JSX.Element {
  const segments = [
    {
      key: "home",
      label: `${home.shortName} wins`,
      value: headToHead.homeWins,
      bar: "bg-series-1",
      align: "text-left",
    },
    {
      key: "draws",
      label: "Draws",
      value: headToHead.draws,
      bar: "bg-border-strong",
      align: "text-center",
    },
    {
      key: "away",
      label: `${away.shortName} wins`,
      value: headToHead.awayWins,
      bar: "bg-series-2",
      align: "text-right",
    },
  ] as const;

  return (
    <div>
      <p className="type-caption mb-2">
        {headToHead.played} {headToHead.played === 1 ? "meeting" : "meetings"}
      </p>
      <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <span
                key={segment.key}
                className={cn("h-full", segment.bar)}
                style={{ flexGrow: segment.value, flexBasis: 0 }}
              />
            ),
        )}
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {segments.map((segment) => (
          <div key={segment.key} className={segment.align}>
            <dd className="type-score text-2xl text-text-primary">
              {segment.value}
            </dd>
            <dt className="type-small text-text-secondary">{segment.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Meeting({
  meeting,
  href,
}: {
  readonly meeting: HeadToHeadMeeting;
  readonly href: string | undefined;
}): React.JSX.Element {
  const homeWon = meeting.score.home > meeting.score.away;
  const awayWon = meeting.score.away > meeting.score.home;
  const row = (
    <>
      <span className="type-small w-24 shrink-0 text-text-muted">
        {formatShortDate(meeting.kickoffAt)}
        <span className="ml-1.5">{meeting.leagueCode}</span>
      </span>
      <span
        className={cn(
          "type-body flex min-w-0 flex-1 items-center justify-end gap-2",
          awayWon ? "text-text-secondary" : "text-text-primary",
          homeWon && "font-semibold",
        )}
      >
        <span className="truncate">{meeting.home.shortName}</span>
        <TeamCrest team={meeting.home} size={20} decorative />
      </span>
      <span className="type-data shrink-0 font-bold text-text-primary">
        {meeting.score.home}–{meeting.score.away}
      </span>
      <span
        className={cn(
          "type-body flex min-w-0 flex-1 items-center gap-2",
          homeWon ? "text-text-secondary" : "text-text-primary",
          awayWon && "font-semibold",
        )}
      >
        <TeamCrest team={meeting.away} size={20} decorative />
        <span className="truncate">{meeting.away.shortName}</span>
      </span>
    </>
  );
  const label = `${meeting.home.name} ${String(meeting.score.home)}, ${meeting.away.name} ${String(meeting.score.away)}, ${formatShortDate(meeting.kickoffAt)}`;

  return href === undefined ? (
    <div aria-label={label} role="group" className="flex items-center gap-3 py-2">
      {row}
    </div>
  ) : (
    <Link
      to={href}
      aria-label={label}
      className="flex items-center gap-3 rounded-sm py-2 transition-colors duration-[var(--bn-duration-fast)] hover:bg-surface-hover focus-ring"
    >
      {row}
    </Link>
  );
}
