import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeagueId } from "@betng/contracts";
import {
  formatMatchday,
  toLocalDateKey,
  type MatchSummary,
} from "@betng/ui-core";
import {
  EmptyState,
  ErrorState,
  IconButton,
  MatchRow,
  SectionHeader,
  Select,
  SkeletonRows,
  Tabs,
} from "@betng/ui-web";
import {
  useCompletedMatchdays,
  useLeague,
  useLeagues,
  useMatches,
} from "../hooks/queries";

type Mode = "DAY" | "MATCHDAY";

function shiftDate(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00`);

  d.setDate(d.getDate() + days);

  return toLocalDateKey(d);
}

function dayLabel(key: string): string {
  const today = toLocalDateKey(new Date());

  if (key === today) return "Today";
  if (key === shiftDate(today, -1)) return "Yesterday";

  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function ResultsPage(): React.JSX.Element {
  const leagues = useLeagues();
  const [leagueId, setLeagueId] = useState<string>("");
  const effectiveLeague =
    leagueId === "" ? leagues.data?.[0]?.id : (leagueId as LeagueId);
  const league = useLeague(effectiveLeague);
  const [mode, setMode] = useState<Mode>("DAY");
  const [date, setDate] = useState(() => toLocalDateKey(new Date()));
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [matchday, setMatchday] = useState<number | undefined>(undefined);

  const currentSeason = league.data?.currentSeason;
  const activeSeason = season ?? currentSeason;
  const matchdays = useCompletedMatchdays(effectiveLeague, activeSeason);
  const activeMatchday = matchday ?? matchdays.data?.[0];

  const filter = useMemo(
    () =>
      mode === "DAY"
        ? {
            date,
            phases: ["FINISHED", "SETTLED"] as const,
            limit: 60,
            ...(effectiveLeague === undefined
              ? {}
              : { leagueId: effectiveLeague }),
          }
        : {
            ...(effectiveLeague === undefined
              ? {}
              : { leagueId: effectiveLeague }),
            season: activeSeason,
            matchday: activeMatchday,
            phases: ["FINISHED", "SETTLED"] as const,
          },
    [mode, date, effectiveLeague, activeSeason, activeMatchday],
  );
  const results = useMatches(filter as never, {
    enabled:
      mode === "DAY" ||
      (activeSeason !== undefined && activeMatchday !== undefined),
    refetchMs: 8000,
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, MatchSummary[]>();

    for (const m of results.data ?? []) {
      const key = `${m.leagueCode} · Season ${String(m.season)} · ${formatMatchday(m.matchday)}`;

      groups.set(key, [...(groups.get(key) ?? []), m]);
    }

    return [...groups.entries()];
  }, [results.data]);

  const seasonOptions = useMemo(() => {
    const cs = currentSeason ?? 1;

    return Array.from({ length: Math.min(cs, 6) }, (_, i) => cs - i).map(
      (s) => ({ value: String(s), label: `Season ${String(s)}` }),
    );
  }, [currentSeason]);

  return (
    <div className="space-y-5">
      <SectionHeader
        as="h1"
        eyebrow="Archive"
        title="Results"
        aside={
          <Select
            label="League"
            size="sm"
            value={effectiveLeague ?? ""}
            onChange={(v) => {
              setLeagueId(v);
              setSeason(undefined);
              setMatchday(undefined);
            }}
            options={(leagues.data ?? []).map((l) => ({
              value: l.id,
              label: l.name,
            }))}
          />
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label="Browse by"
          variant="segmented"
          value={mode}
          onChange={setMode}
          items={[
            { value: "DAY", label: "By day" },
            { value: "MATCHDAY", label: "By matchday" },
          ]}
        />
        {mode === "DAY" ? (
          <div className="flex items-center gap-1">
            <IconButton
              label="Previous day"
              size="sm"
              onClick={() => {
                setDate((d) => shiftDate(d, -1));
              }}
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="min-w-40 text-center text-sm font-semibold">
              {dayLabel(date)}
            </span>
            <IconButton
              label="Next day"
              size="sm"
              disabled={date >= toLocalDateKey(new Date())}
              onClick={() => {
                setDate((d) => shiftDate(d, 1));
              }}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              label="Season"
              size="sm"
              value={String(activeSeason ?? "")}
              onChange={(v) => {
                setSeason(Number(v));
                setMatchday(undefined);
              }}
              options={seasonOptions}
            />
            <Select
              label="Matchday"
              size="sm"
              value={String(activeMatchday ?? "")}
              onChange={(v) => {
                setMatchday(Number(v));
              }}
              options={(matchdays.data ?? []).map((md) => ({
                value: String(md),
                label: formatMatchday(md),
              }))}
            />
          </div>
        )}
      </div>

      {results.isPending ? (
        <div className="rounded-md border border-border bg-surface">
          <SkeletonRows rows={8} className="p-4" />
        </div>
      ) : results.isError ? (
        <ErrorState
          error={results.error}
          onRetry={() => void results.refetch()}
        />
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No results"
          description={
            mode === "DAY"
              ? "No matches finished on this day."
              : "This matchday has not been completed yet."
          }
        />
      ) : (
        grouped.map(([label, items]) => (
          <section key={label} aria-label={label}>
            <h2 className="caps-label mb-2">{label}</h2>
            <div className="divide-y divide-border rounded-md border border-border bg-surface">
              {items.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
