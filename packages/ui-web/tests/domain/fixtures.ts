import type {
  BetView,
  LineupPlayer,
  MarketView,
  MatchClockView,
  MatchEventView,
  MatchStats,
  MatchSummary,
  SelectionView,
  SideStats,
  SlipSelection,
  StandingRow,
  StandingsView,
  TeamLineup,
  TeamView,
} from "@betng/ui-core";

export const NOW = Date.parse("2026-03-01T15:00:00.000Z");

export function team(id: string, name: string, code: string): TeamView {
  return {
    id: id as TeamView["id"],
    leagueId: "league-1" as TeamView["leagueId"],
    name,
    shortName: name.split(" ")[0] ?? name,
    code,
    city: "Test City",
    stadium: `${name} Ground`,
    colors: { primary: "#123456", secondary: "#abcdef", onPrimary: "#ffffff" },
    strength: 70,
  };
}

export const HOME = team("team-home", "Ashford City", "ASH");
export const AWAY = team("team-away", "Riverside", "RIV");

export function clock(overrides: Partial<MatchClockView> = {}): MatchClockView {
  return {
    period: "SECOND_HALF",
    minute: 67,
    asOf: new Date(NOW).toISOString(),
    ...overrides,
  };
}

export function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: "match-1" as MatchSummary["id"],
    fixtureId: "fixture-1" as MatchSummary["fixtureId"],
    leagueId: "league-1" as MatchSummary["leagueId"],
    leagueName: "Test League",
    leagueCode: "TLG",
    season: 3,
    matchday: 7,
    home: HOME,
    away: AWAY,
    kickoffAt: new Date(NOW + 3 * 60 * 60 * 1000).toISOString(),
    bettingClosesAt: new Date(NOW + 3 * 60 * 60 * 1000 - 60_000).toISOString(),
    status: "SCHEDULED",
    phase: "SCHEDULED",
    score: { home: 0, away: 0 },
    openMarkets: 4,
    ...overrides,
  };
}

let sequence = 0;

export function event(
  overrides: Partial<MatchEventView> & Pick<MatchEventView, "id" | "kind">,
): MatchEventView {
  sequence += 1;

  return {
    matchId: "match-1" as MatchEventView["matchId"],
    sequence,
    minute: 1,
    score: { home: 0, away: 0 },
    description: overrides.kind,
    occurredAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

export function sideStats(overrides: Partial<SideStats> = {}): SideStats {
  return {
    possession: 50,
    shots: 8,
    shotsOnTarget: 3,
    corners: 4,
    fouls: 9,
    offsides: 2,
    yellowCards: 1,
    redCards: 0,
    ...overrides,
  };
}

export function stats(
  home: Partial<SideStats> = {},
  away: Partial<SideStats> = {},
): MatchStats {
  return { home: sideStats(home), away: sideStats(away) };
}

export function selection(
  id: string,
  label: string,
  odds: number,
  overrides: Partial<SelectionView> = {},
): SelectionView {
  return {
    id: id as SelectionView["id"],
    marketId: "market-1" as SelectionView["marketId"],
    code: id,
    label,
    shortLabel: label.slice(0, 3),
    odds,
    probability: 0.3,
    trend: "STEADY",
    ...overrides,
  };
}

export function market(overrides: Partial<MarketView> = {}): MarketView {
  return {
    id: "market-1" as MarketView["id"],
    matchId: "match-1" as MarketView["matchId"],
    kind: "MATCH_RESULT",
    name: "Fixture market A",
    status: "OPEN",
    columns: 3,
    selections: [
      selection("sel-1", "One", 2.1),
      selection("sel-2", "Two", 3.2),
      selection("sel-3", "Three", 3.6),
    ],
    ...overrides,
  };
}

export function player(
  id: string,
  name: string,
  overrides: Partial<LineupPlayer> = {},
): LineupPlayer {
  return { id, name, ...overrides };
}

export function lineup(
  side: TeamLineup["side"],
  overrides: Partial<TeamLineup> = {},
): TeamLineup {
  const owner = side === "HOME" ? HOME : AWAY;

  return {
    teamId: owner.id,
    side,
    starting: [
      player(`${side}-1`, `${side} Keeper`, { shirt: 1, position: "GK" }),
      player(`${side}-2`, `${side} Defender`, { shirt: 4, position: "DF" }),
    ],
    substitutes: [player(`${side}-12`, `${side} Reserve`, { shirt: 12 })],
    ...overrides,
  };
}

export function standingRow(
  position: number,
  rowTeam: TeamView,
  overrides: Partial<StandingRow> = {},
): StandingRow {
  return {
    position,
    team: rowTeam,
    played: 10,
    won: 6,
    drawn: 2,
    lost: 2,
    goalsFor: 18,
    goalsAgainst: 9,
    goalDifference: 9,
    points: 20,
    form: ["W", "D", "L"],
    ...overrides,
  };
}

export function standings(rows: readonly StandingRow[]): StandingsView {
  return {
    leagueId: "league-1" as StandingsView["leagueId"],
    season: 3,
    matchdaysPlayed: 10,
    rows,
  };
}

export function slipSelection(
  overrides: Partial<SlipSelection> = {},
): SlipSelection {
  return {
    selectionId: "sel-1" as SlipSelection["selectionId"],
    marketId: "market-1" as SlipSelection["marketId"],
    matchId: "match-1" as SlipSelection["matchId"],
    marketKind: "MATCH_RESULT",
    marketName: "Fixture market A",
    selectionLabel: "One",
    odds: 2.1,
    matchLabel: "Ashford City v Riverside",
    leagueCode: "TLG",
    kickoffAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

export function bet(overrides: Partial<BetView> = {}): BetView {
  return {
    id: "bet-1" as BetView["id"],
    legs: [{ ...slipSelection(), outcome: "PENDING" }],
    stake: 20_000,
    totalOdds: 2.1,
    potentialPayout: 41_500,
    status: "PENDING",
    placedAt: new Date(NOW).toISOString(),
    reference: "PLATFORM-REF-9",
    ...overrides,
  };
}
