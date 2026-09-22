import { useEffect } from "react";
import { formatKickoffTime, type LeagueView, type MatchSummary, type StandingRow, type TopScorer } from "@betng/ui-core";
import { useAsync } from "../hooks/useAsync";
import { useInactivity } from "../hooks/useInactivity";
import { useNow } from "../hooks/useNow";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { cn } from "../lib/cn";
import { useDisplaySettings } from "../lib/displaySettings";
import { withinNextDay } from "../lib/fixtures";
import { reads } from "../lib/reads";
import { LogoMark } from "./BrandMarks";
import { TeamMark } from "./TeamMark";

const ROTATE_MS = 12_000;
const PLACES = ["items-start justify-start", "items-end justify-end", "items-start justify-end", "items-end justify-start", "items-center justify-center"] as const;

type Card =
  | { readonly kind: "leader"; readonly league: LeagueView; readonly row: StandingRow }
  | { readonly kind: "scorer"; readonly league: LeagueView; readonly scorer: TopScorer }
  | { readonly kind: "next"; readonly matches: readonly MatchSummary[] };

async function loadCards(now: number): Promise<readonly Card[]> {
  const [leagues, upcoming] = await Promise.all([reads.listLeagues(), reads.listMatches({ phases: ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED"] }).catch(() => [] as readonly MatchSummary[])]);
  const perLeague = await Promise.all(
    leagues.map(async (league): Promise<readonly Card[]> => {
      const [table, scorers] = await Promise.all([
        reads.getStandings(league.id).catch(() => undefined),
        reads.getTopScorers(league.id).catch(() => [] as readonly TopScorer[]),
      ]);
      const leader = table?.rows[0];
      const top = scorers[0];

      return [...(leader === undefined ? [] : [{ kind: "leader", league, row: leader } as const]), ...(top === undefined ? [] : [{ kind: "scorer", league, scorer: top } as const])];
    }),
  );
  const next = withinNextDay(upcoming, now).slice(0, 5);

  return [...(next.length === 0 ? [] : [{ kind: "next", matches: next } as const]), ...perLeague.flat()];
}

function CardView({ card }: { readonly card: Card }): React.JSX.Element {
  if (card.kind === "next") {
    return (
      <div>
        <p className="caps-label">Next kick-offs</p>
        <ul className="mt-[0.6rem] space-y-[0.5rem]">
          {card.matches.map((m) => (
            <li key={m.id} className="flex items-center gap-[0.8rem] text-[1.4rem] font-bold">
              <span className="w-[5rem] font-display font-black tabular text-text-secondary">{formatKickoffTime(m.kickoffAt)}</span>
              <TeamMark team={m.home} size="sm" />
              {m.home.shortName} <span className="text-text-muted">v</span> {m.away.shortName}
              <TeamMark team={m.away} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (card.kind === "leader") {
    return (
      <div className="flex items-center gap-[1.6rem]">
        <TeamMark team={card.row.team} size="hero" />
        <div>
          <p className="caps-label">{card.league.name} · top of the table</p>
          <p className="font-display text-[3rem] font-black leading-none tracking-tight">{card.row.team.name}</p>
          <p className="mt-[0.4rem] text-[1.4rem] font-semibold text-text-secondary tabular">
            {card.row.points} pts · {card.row.won}W {card.row.drawn}D {card.row.lost}L · GD {card.row.goalDifference > 0 ? "+" : ""}
            {card.row.goalDifference}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[1.6rem]">
      <TeamMark team={card.scorer.team} size="hero" />
      <div>
        <p className="caps-label">{card.league.name} · top scorer</p>
        <p className="font-display text-[3rem] font-black leading-none tracking-tight">{card.scorer.player}</p>
        <p className="mt-[0.4rem] text-[1.4rem] font-semibold text-text-secondary tabular">
          {card.scorer.goals} goals · {card.scorer.assists} assists · {card.scorer.team.name}
        </p>
      </div>
    </div>
  );
}

/* After a spell without a key press, and only while nothing is in play, the display rests on platform statistics. It moves between corners so nothing burns in. */
export function AmbientScreensaver(): React.JSX.Element | null {
  const [settings] = useDisplaySettings();
  const idle = useInactivity(settings.ambientAfterMin * 60_000);
  const reduced = useReducedMotion();
  const now = useNow(ROTATE_MS);
  const live = useAsync(() => (idle ? reads.listMatches({ phases: ["LIVE", "HALFTIME"] }) : Promise.resolve(undefined)), [idle], 10_000);
  const active = idle && live.data !== undefined && live.data.length === 0;
  const cards = useAsync(() => (active ? loadCards(Date.now()) : Promise.resolve([] as readonly Card[])), [active], 5 * 60_000);

  useEffect(() => {
    if (!active) return;

    const onKey = (event: KeyboardEvent): void => {
      event.preventDefault();
    };

    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [active]);

  if (!active) return null;

  const list = cards.data ?? [];
  const step = Math.floor(now / ROTATE_MS);
  const card = list.length === 0 ? undefined : list[step % list.length];

  return (
    <div role="status" aria-label="Screensaver. Press any key to return." className={cn("fixed inset-0 z-[65] flex bg-background p-[4rem]", PLACES[step % PLACES.length])}>
      <div key={step} className={cn("max-w-[56rem] border border-border bg-surface px-[2.4rem] py-[2rem]", !reduced && "animate-fade-in")}>
        {card === undefined ? (
          <div className="flex items-center gap-[1rem]">
            <LogoMark className="size-[3rem]" />
            <p className="font-display text-[2rem] font-black">BETNG LIVE</p>
          </div>
        ) : (
          <CardView card={card} />
        )}
        <p className="mt-[1.4rem] text-[0.95rem] text-text-muted">Nothing in play right now · press any key to return</p>
      </div>
    </div>
  );
}
