import { formatMatchday, type MatchSummary } from "@betng/ui-core";
import {
  Countdown,
  Focusable,
  LiveTag,
  ErrorPanel,
  Skeleton,
  TeamMark,
} from "../components";
import { useAsync } from "../hooks/useAsync";
import { dataSource } from "../services/dataSource";

function Card({ match }: { readonly match: MatchSummary }): React.JSX.Element {
  return (
    <Focusable
      to={`/live/${match.id}`}
      className="w-full border border-border bg-surface px-[1.4rem] py-[1.1rem] text-left"
    >
      <div className="flex items-center justify-between">
        <LiveTag phase={match.phase} />
        <span className="text-[0.9rem] font-semibold text-text-muted">
          {match.leagueCode} · {formatMatchday(match.matchday)}
        </span>
      </div>
      <div className="mt-[0.9rem] flex items-center justify-between gap-[1rem]">
        <div className="flex flex-col items-center gap-[0.4rem] text-center">
          <TeamMark team={match.home} size="lg" />
          <span className="text-[1rem] font-bold">{match.home.shortName}</span>
        </div>
        <div className="text-center">
          <Countdown
            to={match.kickoffAt}
            className="font-display text-[2.6rem] font-black leading-none"
          />
          <p className="caps-label mt-[0.3rem]">Kick-off</p>
        </div>
        <div className="flex flex-col items-center gap-[0.4rem] text-center">
          <TeamMark team={match.away} size="lg" />
          <span className="text-[1rem] font-bold">{match.away.shortName}</span>
        </div>
      </div>
    </Focusable>
  );
}

export function UpcomingScreen(): React.JSX.Element {
  const next = useAsync(
    () =>
      dataSource.listMatches({
        phases: ["BETTING_OPEN", "BETTING_CLOSED", "SCHEDULED"],
        limit: 12,
      }),
    [],
    5000,
  );

  return (
    <div className="flex h-full flex-col">
      <p className="caps-label">Coming up</p>
      <h1 className="font-display text-[2.4rem] font-black tracking-tight">
        Next matches
      </h1>
      <div className="mt-[1rem] grid grid-cols-3 content-start gap-[0.9rem]">
        {next.data === undefined && next.error !== undefined ? (
          <ErrorPanel title="The schedule could not be loaded" className="col-span-3" />
        ) : next.data === undefined ? (
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[10rem]" />
          ))
        ) : next.data.length === 0 ? (
          <p className="col-span-3 py-[4rem] text-center text-[1.3rem] text-text-muted">
            Nothing scheduled.
          </p>
        ) : (
          next.data.map((m) => <Card key={m.id} match={m} />)
        )}
      </div>
    </div>
  );
}
