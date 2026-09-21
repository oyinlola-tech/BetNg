import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, ReceiptText } from "lucide-react";
import {
  FASTBET_CODES,
  canBet,
  formatKickoffTime,
  formatMoney,
  formatOdds,
  isInPlay,
  isSelected as isSlipSelected,
  matchClock,
  parseFastbet,
  slipTotals,
  type MarketView,
  type MatchMarketsView,
  type MatchPhase,
  type MatchSummary,
  type SelectionView,
} from "@betng/ui-core";
import { Button, Countdown, EmptyState, ErrorState, LeagueMark, Sheet, SkeletonRows, cn, useMediaQuery, useNow } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { Kbd } from "../components/Kbd";
import { SlipPanel } from "../components/SlipPanel";
import { WeekGrid, findSelection, type GridGroup } from "../components/WeekGrid";
import { useLeagues, useMarketsFor, useMatches } from "../hooks/queries";
import { useShortcuts } from "../hooks/useShortcuts";
import { useSlip } from "../stores/slip.store";

const PHASES: readonly MatchPhase[] = ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED", "LIVE", "HALFTIME"];

type TabKey = "MAIN" | "TOTALS" | "HANDICAP";

const TABS: Readonly<Record<TabKey, { readonly label: string; readonly groups: readonly GridGroup[] }>> = {
  MAIN: {
    label: "Main",
    groups: [
      {
        key: "1x2",
        title: "Match Result",
        columns: [
          { key: "1", header: "1", kind: "MATCH_RESULT", selectionCode: "HOME" },
          { key: "x", header: "X", kind: "MATCH_RESULT", selectionCode: "DRAW" },
          { key: "2", header: "2", kind: "MATCH_RESULT", selectionCode: "AWAY" },
        ],
      },
      {
        key: "dc",
        title: "Double Chance",
        columns: [
          { key: "1x", header: "1X", kind: "DOUBLE_CHANCE", selectionCode: "HOME_DRAW" },
          { key: "12", header: "12", kind: "DOUBLE_CHANCE", selectionCode: "HOME_AWAY" },
          { key: "x2", header: "X2", kind: "DOUBLE_CHANCE", selectionCode: "DRAW_AWAY" },
        ],
      },
      {
        key: "btts",
        title: "GG / NG",
        columns: [
          { key: "gg", header: "GG", kind: "BOTH_TEAMS_TO_SCORE", selectionCode: "YES" },
          { key: "ng", header: "NG", kind: "BOTH_TEAMS_TO_SCORE", selectionCode: "NO" },
        ],
      },
      {
        key: "ou25",
        title: "Over / Under",
        columns: [
          { key: "o25", header: "OV 2.5", kind: "OVER_UNDER", line: 2.5, selectionCode: "OVER_2_5" },
          { key: "u25", header: "UN 2.5", kind: "OVER_UNDER", line: 2.5, selectionCode: "UNDER_2_5" },
        ],
      },
    ],
  },
  TOTALS: {
    label: "Over/Under",
    groups: [1.5, 2.5, 3.5].map((line) => {
      const tag = String(line).replace(".", "_");

      return {
        key: `ou${tag}`,
        title: `Total Goals ${String(line)}`,
        columns: [
          { key: `o${tag}`, header: `OV ${String(line)}`, kind: "OVER_UNDER" as const, line, selectionCode: `OVER_${tag}` },
          { key: `u${tag}`, header: `UN ${String(line)}`, kind: "OVER_UNDER" as const, line, selectionCode: `UNDER_${tag}` },
        ],
      };
    }),
  },
  HANDICAP: {
    label: "Handicap",
    groups: [
      {
        key: "spread",
        title: "Goal Spread 1.5",
        columns: [
          { key: "h", header: "1 (-1.5)", kind: "GOAL_SPREAD", line: -1.5, selectionCode: "HOME_MINUS_1_5" },
          { key: "a", header: "2 (+1.5)", kind: "GOAL_SPREAD", line: -1.5, selectionCode: "AWAY_PLUS_1_5" },
        ],
      },
    ],
  },
};

interface Week {
  readonly key: string;
  readonly matchday: number;
  readonly kickoffAt: string;
  readonly bettingClosesAt: string;
  readonly matches: readonly MatchSummary[];
  readonly open: boolean;
  readonly live: boolean;
}

function toWeeks(matches: readonly MatchSummary[]): readonly Week[] {
  const map = new Map<string, MatchSummary[]>();

  for (const match of matches) {
    const key = `${String(match.season)}:${String(match.matchday)}`;

    map.set(key, [...(map.get(key) ?? []), match]);
  }

  return [...map.entries()]
    .map(([key, list]): Week => {
      const sorted = [...list].sort((a, b) => a.home.name.localeCompare(b.home.name));
      const first = sorted[0] as MatchSummary;

      return { key, matchday: first.matchday, kickoffAt: first.kickoffAt, bettingClosesAt: first.bettingClosesAt, matches: sorted, open: sorted.some((m) => canBet(m.phase)), live: sorted.some((m) => isInPlay(m.phase)) };
    })
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

function LiveMinute({ kickoffAt }: { readonly kickoffAt: string }): React.JSX.Element {
  const now = useNow(1000);

  return <span className="tabular">{matchClock(kickoffAt, now).minute}'</span>;
}

function VirtualLeague(): React.JSX.Element {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const leagues = useLeagues();
  const [leagueId, setLeagueId] = useState<string | undefined>();
  const [tab, setTab] = useState<TabKey>("MAIN");
  const [pickedWeek, setPickedWeek] = useState<string | undefined>();
  const [expandedId, setExpandedId] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<{ readonly tone: "ok" | "error"; readonly text: string } | undefined>();
  const fastbetRef = useRef<HTMLInputElement>(null);
  const { selections, stake, toggle, open, setOpen } = useSlip();

  const activeLeague = leagues.data?.find((l) => l.id === leagueId) ?? leagues.data?.[0];
  const matches = useMatches(activeLeague === undefined ? {} : { leagueId: activeLeague.id, phases: PHASES }, { enabled: activeLeague !== undefined, refetchMs: 2000 });

  const weeks = useMemo(() => toWeeks(matches.data ?? []), [matches.data]);
  const liveWeek = weeks.find((w) => w.live);
  const upcoming = weeks.filter((w) => !w.live);
  const week = upcoming.find((w) => w.key === pickedWeek) ?? upcoming.find((w) => w.open) ?? upcoming[0];

  useEffect(() => {
    setPickedWeek(undefined);
    setExpandedId(undefined);
    setFeedback(undefined);
  }, [activeLeague?.id]);

  const ids = useMemo(() => (week?.matches ?? []).map((m) => m.id), [week]);
  const marketQueries = useMarketsFor(ids);
  const marketsById = useMemo(() => {
    const map = new Map<string, MatchMarketsView>();

    marketQueries.forEach((q, i) => {
      const id = ids[i];

      if (id !== undefined && q.data !== undefined) map.set(id, q.data);
    });

    return map;
  }, [marketQueries, ids]);

  const isSelected = useCallback((id: string) => isSlipSelected(selections, id), [selections]);
  const onToggle = useCallback(
    (match: MatchSummary, market: MarketView, selection: SelectionView) => {
      toggle({
        selectionId: selection.id,
        marketId: market.id,
        matchId: match.id,
        marketKind: market.kind,
        marketName: market.name,
        selectionLabel: selection.label,
        odds: selection.odds,
        matchLabel: `${match.home.name} v ${match.away.name}`,
        leagueCode: match.leagueCode,
        kickoffAt: match.kickoffAt,
      });
    },
    [toggle],
  );
  const onExpand = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? undefined : id));
  }, []);

  const submitFastbet = (): void => {
    if (week === undefined) return;

    if (!week.open) {
      setFeedback({ tone: "error", text: "Betting is not open for this week yet." });

      return;
    }

    const parsed = parseFastbet(code, week.matches.length);

    if (!parsed.ok) {
      setFeedback({ tone: "error", text: parsed.error });

      return;
    }

    const resolved = parsed.picks.map((pick) => {
      const match = week.matches[pick.event - 1] as MatchSummary;

      return { pick, match, found: findSelection(marketsById.get(match.id), pick) };
    });
    const missing = resolved.find((r) => r.found === undefined || r.found.market.status !== "OPEN");

    if (missing !== undefined) {
      setFeedback({ tone: "error", text: `${missing.pick.label} is not open on event ${String(missing.pick.event)}.` });

      return;
    }

    for (const { match, found } of resolved) {
      if (found !== undefined && !isSlipSelected(useSlip.getState().selections, found.selection.id)) onToggle(match, found.market, found.selection);
    }

    setFeedback({ tone: "ok", text: resolved.map((r) => `${String(r.pick.event)} ${r.match.home.code}-${r.match.away.code} ${r.pick.label}`).join(" · ") });
    setCode("");
  };

  const bindings = useMemo(
    () => ({
      "/": () => {
        fastbetRef.current?.focus();
      },
    }),
    [],
  );

  useShortcuts(bindings);

  const totals = slipTotals(selections, stake);

  return (
    <div className={cn("grid h-full min-h-0", desktop ? "grid-cols-[minmax(0,1fr)_21.5rem]" : "grid-cols-1")}>
      <section aria-label="Virtual football" className="flex min-h-0 min-w-0 flex-col">
        <header className="border-b border-border bg-surface">
          <div className="flex flex-wrap items-stretch gap-x-4 gap-y-2 px-3 pt-2">
            <nav aria-label="Leagues" className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto scrollbar-thin">
              {(leagues.data ?? []).map((league) => {
                const active = league.id === activeLeague?.id;

                return (
                  <button
                    key={league.id}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      setLeagueId(league.id);
                    }}
                    className={cn(
                      "flex h-10 shrink-0 items-center gap-2 rounded-t-sm border border-b-0 px-3 text-base font-semibold uppercase tracking-caps transition-colors focus-ring",
                      active ? "border-border bg-background text-text-primary" : "border-transparent text-text-muted hover:text-text-primary",
                    )}
                  >
                    <LeagueMark slug={league.slug} code={league.code} size={18} />
                    {league.name}
                  </button>
                );
              })}
            </nav>

            <dl className="flex shrink-0 items-center gap-5 pb-1.5 text-right">
              <div>
                <dt className="caps-label">Week</dt>
                <dd className="font-display text-xl font-bold tabular leading-none text-text-primary">{week?.matchday ?? "–"}</dd>
              </div>
              <div>
                <dt className="caps-label">Kick-off</dt>
                <dd className="font-display text-xl font-bold tabular leading-none text-text-primary">{week === undefined ? "–" : formatKickoffTime(week.kickoffAt)}</dd>
              </div>
              <div className={cn("rounded-sm px-2.5 py-1", week?.open === true ? "bg-brand-subtle" : "bg-surface-sunken")}>
                <dt className="caps-label">{week?.open === true ? "Betting closes in" : "Betting opens soon"}</dt>
                <dd className={cn("font-display text-2xl font-bold tabular leading-none", week?.open === true ? "text-brand" : "text-text-muted")}>{week === undefined ? "–" : <Countdown to={week.open ? week.bettingClosesAt : week.kickoffAt} />}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-background px-3 py-2">
            <div role="tablist" aria-label="Market groups" className="flex gap-1">
              {(Object.keys(TABS) as TabKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => {
                    setTab(key);
                  }}
                  className={cn("h-9 rounded-sm px-4 text-base font-semibold transition-colors focus-ring", tab === key ? "bg-brand text-text-on-brand" : "bg-surface text-text-secondary hover:bg-surface-hover")}
                >
                  {TABS[key].label}
                </button>
              ))}
            </div>

            {upcoming.length > 1 && (
              <div className="flex items-center gap-1" role="group" aria-label="Week">
                {upcoming.map((w) => (
                  <button
                    key={w.key}
                    type="button"
                    aria-pressed={w.key === week?.key}
                    onClick={() => {
                      setPickedWeek(w.key);
                      setExpandedId(undefined);
                    }}
                    className={cn("h-9 rounded-sm border px-2.5 text-sm font-semibold tabular transition-colors focus-ring", w.key === week?.key ? "border-brand text-brand" : "border-border text-text-muted hover:text-text-primary")}
                  >
                    WK {w.matchday}
                  </button>
                ))}
              </div>
            )}

            <form
              className="ml-auto flex min-w-64 flex-1 items-center gap-2 sm:flex-none"
              onSubmit={(event) => {
                event.preventDefault();
                submitFastbet();
              }}
            >
              <label htmlFor="fastbet" className="caps-label shrink-0">
                Fastbet
              </label>
              <div className="flex h-9 flex-1 items-center rounded-sm border border-border bg-surface-sunken pr-1 transition-colors focus-within:border-brand sm:w-56">
                <input
                  ref={fastbetRef}
                  id="fastbet"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setFeedback(undefined);
                  }}
                  placeholder="Enter code, e.g. 3 1"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="fastbet-help"
                  className="h-full w-full min-w-0 bg-transparent px-2.5 font-mono text-base uppercase text-text-primary outline-none placeholder:normal-case placeholder:text-text-muted"
                />
                <Kbd>/</Kbd>
              </div>
              <Button type="submit" size="sm" variant="secondary" icon={<CornerDownLeft className="size-3.5" />} disabled={code.trim() === ""}>
                Add
              </Button>
            </form>
          </div>
          <p id="fastbet-help" role="status" className={cn("min-h-6 px-3 pb-1 text-sm", feedback?.tone === "error" ? "text-danger" : feedback?.tone === "ok" ? "text-success" : "text-text-muted")}>
            {feedback?.text ?? `Event number then code: ${FASTBET_CODES.join("  ")}. Separate several with commas.`}
          </p>
        </header>

        <div className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-thin", !desktop && selections.length > 0 && "pb-20")}>
          {matches.error !== null && matches.data === undefined ? (
            <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
          ) : week === undefined ? (
            matches.isLoading || leagues.isLoading ? (
              <SkeletonRows rows={10} className="p-4" />
            ) : (
              <EmptyState title="No week scheduled" description="The next week for this league appears here as soon as it is scheduled." />
            )
          ) : (
            <WeekGrid matches={week.matches} marketsById={marketsById} groups={TABS[tab].groups} bettable={week.open} expandedId={expandedId} onExpand={onExpand} isSelected={isSelected} onToggle={onToggle} />
          )}

          {liveWeek !== undefined && (
            <section aria-label={`Week ${String(liveWeek.matchday)} in play`} className="border-t border-border bg-surface px-3 py-2.5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                <span className="inline-flex items-center gap-1.5 rounded-xs bg-live px-1.5 py-0.5 text-xs font-bold uppercase tracking-caps text-text-on-live">
                  <span className="size-1.5 rounded-full bg-current animate-pulse-live" aria-hidden />
                  Live
                </span>
                Week {liveWeek.matchday}
                <span className="font-display text-md font-bold text-live">{liveWeek.matches.some((m) => m.phase === "LIVE") ? <LiveMinute kickoffAt={liveWeek.kickoffAt} /> : "HT"}</span>
              </h2>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
                {liveWeek.matches.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-1.5 text-sm">
                    <span className="w-4 text-right tabular text-text-muted">{i + 1}</span>
                    <span className="font-semibold text-text-primary">{m.home.code}</span>
                    <span className="rounded-xs bg-surface-sunken px-1.5 font-display font-bold tabular text-text-primary">
                      {m.score.home}-{m.score.away}
                    </span>
                    <span className="font-semibold text-text-primary">{m.away.code}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>

      {desktop ? (
        <SlipPanel className="border-l border-border" />
      ) : (
        <>
          {selections.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface-elevated p-2 shadow-lg">
              <Button
                full
                size="lg"
                onClick={() => {
                  setOpen(true);
                }}
                icon={<ReceiptText className="size-4" />}
                className="justify-between"
              >
                <span>
                  {selections.length} selection{selections.length === 1 ? "" : "s"} · {formatOdds(totals.totalOdds)}
                </span>
                <span className="tabular">Return {formatMoney(totals.potentialReturn)}</span>
              </Button>
            </div>
          )}
          <Sheet
            open={open}
            onClose={() => {
              setOpen(false);
            }}
            title="Bet slip"
            side="right"
          >
            <SlipPanel className="h-full" />
          </Sheet>
        </>
      )}
    </div>
  );
}

export function VirtualLeaguePage(): React.JSX.Element {
  return (
    <Guard permission="tickets:sell">
      <VirtualLeague />
    </Guard>
  );
}
