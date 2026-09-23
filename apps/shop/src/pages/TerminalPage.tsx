import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReceiptText } from "lucide-react";
import { canBet, formatKickoffTime, formatMoney, formatOdds, isSelected as isSlipSelected, slipTotals, type LeagueView, type MarketView, type MatchPhase, type MatchSummary, type SelectionView } from "@betng/ui-core";
import { Button, EmptyState, ErrorState, LeagueMark, SearchInput, Sheet, SkeletonRows, Tabs, cn, useMediaQuery } from "@betng/ui-web";
import { Guard } from "../components/Guard";
import { MatchWorkspace } from "../components/MatchWorkspace";
import { Kbd } from "../components/Kbd";
import { MatchOddsRow } from "../components/MatchOddsRow";
import { SlipPanel } from "../components/SlipPanel";
import { useLeagues, useMarketsFor, useMatches } from "../hooks/queries";
import { useShortcuts } from "../hooks/useShortcuts";
import { useSlip } from "../stores/slip.store";

export type TerminalMode = "football" | "virtual" | "live";
type StatusFilter = "OPEN" | "UPCOMING" | "LIVE";

const PHASES: Readonly<Record<StatusFilter, readonly MatchPhase[]>> = {
  OPEN: ["BETTING_OPEN"],
  UPCOMING: ["SCHEDULED", "BETTING_OPEN", "BETTING_CLOSED"],
  LIVE: ["LIVE", "HALFTIME"],
};

const TITLES: Readonly<Record<TerminalMode, { readonly title: string; readonly hint: string }>> = {
  football: { title: "Football", hint: "By competition" },
  virtual: { title: "Virtual Football", hint: "By kick-off" },
  live: { title: "Live", hint: "In play now" },
};

interface Group {
  readonly key: string;
  readonly heading: string;
  readonly league?: LeagueView | undefined;
  readonly matches: readonly MatchSummary[];
}

function Terminal({ mode }: { readonly mode: TerminalMode }): React.JSX.Element {
  const desktop = useMediaQuery("(min-width: 1280px)");
  const [leagueId, setLeagueId] = useState<string | undefined>();
  const [status, setStatus] = useState<StatusFilter>(mode === "live" ? "LIVE" : "OPEN");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | undefined>();
  const [openMatchId, setOpenMatchId] = useState<string | undefined>();
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const { selections, stake, toggle, open, setOpen } = useSlip();

  useEffect(() => {
    setStatus(mode === "live" ? "LIVE" : "OPEN");
    setExpandedId(undefined);
    setOpenMatchId(undefined);
    setCursor(0);
  }, [mode]);

  const leagues = useLeagues();
  const matches = useMatches({ phases: PHASES[status] }, { refetchMs: 3000 });


  const counts = useMemo(() => {
    const map = new Map<string, number>();

    for (const m of matches.data ?? []) map.set(m.leagueId, (map.get(m.leagueId) ?? 0) + 1);

    return map;
  }, [matches.data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (matches.data ?? [])
      .filter((m) => leagueId === undefined || m.leagueId === leagueId)
      .filter((m) => q === "" || m.home.name.toLowerCase().includes(q) || m.away.name.toLowerCase().includes(q) || m.home.code.toLowerCase() === q || m.away.code.toLowerCase() === q)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.leagueName.localeCompare(b.leagueName));
  }, [matches.data, leagueId, query]);

  const openMatch = useMemo(
    () => visible.find((m) => m.id === openMatchId),
    [visible, openMatchId],
  );

  /*
   * The cashier works from the keyboard: the arrows move a cursor down the
   * visible matches, Enter opens the one under it, and Escape steps back out
   * to the list. Nothing here overrides ordinary browser keys — the shortcut
   * hook already refuses to fire printable keys while a field has focus.
   */
  const bindings = useMemo(
    () => ({
      "/": () => {
        searchRef.current?.focus();
      },
      ArrowDown: () => {
        if (openMatchId !== undefined) return;
        setCursor((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
      },
      ArrowUp: () => {
        if (openMatchId !== undefined) return;
        setCursor((index) => Math.max(index - 1, 0));
      },
      Enter: () => {
        if (openMatchId !== undefined) return;

        const match = visible[cursor];

        if (match !== undefined) setOpenMatchId(match.id);
      },
      Escape: () => {
        if (openMatchId !== undefined) setOpenMatchId(undefined);
        else if (expandedId !== undefined) setExpandedId(undefined);
        else setQuery("");
      },
    }),
    [openMatchId, expandedId, cursor, visible],
  );

  useShortcuts(bindings);

  const groups = useMemo((): readonly Group[] => {
    const byKey = new Map<string, Group & { matches: MatchSummary[] }>();

    for (const match of visible) {
      const league = leagues.data?.find((l) => l.id === match.leagueId);
      const key = mode === "virtual" ? match.kickoffAt : `${match.leagueId}:${match.kickoffAt}`;
      const heading = mode === "virtual" ? `Kick-off ${formatKickoffTime(match.kickoffAt)}` : `${match.leagueName} · Matchday ${String(match.matchday)}`;
      const group = byKey.get(key) ?? { key, heading, league: mode === "virtual" ? undefined : league, matches: [] };

      group.matches.push(match);
      byKey.set(key, group);
    }

    return [...byKey.values()];
  }, [visible, leagues.data, mode]);

  const bettableIds = useMemo(() => visible.filter((m) => canBet(m.phase)).map((m) => m.id as string), [visible]);
  const marketResults = useMarketsFor(bettableIds);
  const marketsById = useMemo(() => new Map(bettableIds.map((id, index) => [id, marketResults[index]?.data])), [bettableIds, marketResults]);

  const isSelected = useCallback((id: string) => isSlipSelected(selections, id), [selections]);
  const selectedIds = useMemo(() => new Set(selections.map((s) => s.selectionId as string)), [selections]);
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

  const totals = slipTotals(selections, stake);
  const total = matches.data?.length ?? 0;

  const leagueButton = (id: string | undefined, name: string, count: number, league?: LeagueView): React.JSX.Element => (
    <button
      key={id ?? "all"}
      type="button"
      aria-pressed={leagueId === id}
      onClick={() => {
        setLeagueId(id);
      }}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-sm px-2.5 text-base font-medium transition-colors focus-ring xl:w-full pointer-coarse:h-11",
        leagueId === id ? "bg-brand-subtle text-brand" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
    >
      {league !== undefined ? <LeagueMark slug={league.slug} code={league.code} size={20} /> : <span className="flex size-5 items-center justify-center rounded-xs bg-surface-sunken text-[9px] font-bold text-text-secondary">ALL</span>}
      <span className="truncate xl:flex-1 xl:text-left">{name}</span>
      <span className="text-sm tabular text-text-muted">{count}</span>
    </button>
  );

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_21.5rem] xl:grid-rows-1">
      <aside aria-label="Competitions" className="border-b border-border bg-surface xl:border-b-0 xl:border-r">
        <p className="caps-label hidden px-4 pb-1 pt-3 xl:block">Competitions</p>
        <div className="flex gap-1 overflow-x-auto p-2 scrollbar-thin xl:flex-col xl:overflow-visible">
          {leagueButton(undefined, "All competitions", total)}
          {leagues.data?.map((league) => leagueButton(league.id, league.name, counts.get(league.id) ?? 0, league))}
          {leagues.isPending && <SkeletonRows rows={4} className="hidden p-2 xl:block" />}
        </div>
        {mode !== "live" && (
          <div className="hidden border-t border-border p-3 xl:block">
            <p className="caps-label mb-1.5">Status</p>
            <Tabs
              label="Match status"
              variant="segmented"
              value={status}
              onChange={setStatus}
              items={[
                { value: "OPEN", label: "Open" },
                { value: "UPCOMING", label: "All" },
                { value: "LIVE", label: "Live" },
              ]}
              className="w-full"
            />
          </div>
        )}
        <div className="hidden space-y-1.5 border-t border-border p-3 text-sm text-text-muted xl:block">
          <p className="caps-label mb-1">Keys</p>
          <p className="flex items-center justify-between">Search teams <Kbd>/</Kbd></p>
          <p className="flex items-center justify-between gap-2">Move <span className="flex gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd></span></p>
          <p className="flex items-center justify-between">Open markets <Kbd>Enter</Kbd></p>
          <p className="flex items-center justify-between">Back <Kbd>Esc</Kbd></p>
          <p className="flex items-center justify-between">Stake <Kbd>F8</Kbd></p>
          <p className="flex items-center justify-between">Review ticket <Kbd>F9</Kbd></p>
        </div>
      </aside>

      <section aria-label="Matches" className="flex min-h-0 min-w-0 flex-col">
        {openMatch !== undefined ? (
          <MatchWorkspace
            match={openMatch}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onBack={() => {
              setOpenMatchId(undefined);
            }}
          />
        ) : (
          <>
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-3 py-2">
          <div className="flex items-baseline gap-2">
            <h1 className="font-display text-lg font-semibold tracking-tight">{TITLES[mode].title}</h1>
            <p className="text-sm text-text-muted">{TITLES[mode].hint}</p>
          </div>
          {mode !== "live" && (
            <Tabs
              label="Match status"
              variant="segmented"
              value={status}
              onChange={setStatus}
              items={[
                { value: "OPEN", label: "Open" },
                { value: "UPCOMING", label: "All" },
                { value: "LIVE", label: "Live" },
              ]}
              className="xl:hidden"
            />
          )}
          <SearchInput ref={searchRef} label="Search teams" placeholder="Search teams  /" value={query} onChange={setQuery} className="ml-auto w-full sm:w-56" />
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-thin", !desktop && selections.length > 0 && "pb-16")}>
          {matches.isError && matches.data === undefined ? (
            <ErrorState error={matches.error} onRetry={() => void matches.refetch()} />
          ) : matches.isPending ? (
            <SkeletonRows rows={8} className="p-4" />
          ) : groups.length === 0 ? (
            <EmptyState
              title={status === "LIVE" ? "No matches in play" : query !== "" ? "No team matches that search" : "No matches open for betting"}
              description={status === "LIVE" ? "The next round kicks off shortly. Open matches are on the Football screen." : "A new round opens every few minutes."}
              {...(query === "" ? {} : { action: <Button variant="secondary" size="sm" onClick={() => { setQuery(""); }}>Clear search</Button> })}
            />
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-label={group.heading}>
                <h2 className="sticky top-0 z-sticky flex h-8 items-center gap-2 border-b border-border bg-background px-3 text-sm font-semibold text-text-secondary">
                  {group.league !== undefined && <LeagueMark slug={group.league.slug} code={group.league.code} size={16} />}
                  {group.heading}
                  <span className="ml-auto hidden grid-cols-3 gap-1 text-center text-xs font-semibold text-text-muted lg:grid lg:w-[19rem] lg:pr-0" aria-hidden>
                    <span>1</span>
                    <span>X</span>
                    <span>2</span>
                  </span>
                  <span className="hidden w-9 lg:block" aria-hidden />
                </h2>
                <ul className="bg-surface">
                  {group.matches.map((match) => (
                    <MatchOddsRow
                      key={match.id}
                      match={match}
                      markets={marketsById.get(match.id)}
                      expanded={expandedId === match.id}
                      active={visible[cursor]?.id === match.id}
                      showLeague={mode === "virtual"}
                      onExpand={onExpand}
                      onOpen={setOpenMatchId}
                      isSelected={isSelected}
                      onToggle={onToggle}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
          </>
        )}
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

export function TerminalPage({ mode }: { readonly mode: TerminalMode }): React.JSX.Element {
  return (
    <Guard permission="tickets:sell">
      <Terminal mode={mode} />
    </Guard>
  );
}
