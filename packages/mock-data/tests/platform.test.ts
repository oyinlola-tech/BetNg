import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displayClock, estimateReturn, resolvePhase, type MatchSignal, type SlipSelection } from "@betng/ui-core";
import { COMPETITIONS } from "../src/clubs.js";
import { createMockDataSource, type MockDataSource } from "../src/mockDataSource.js";
import { currentRound, fixturesForRound, type FixtureRef } from "../src/season.js";
import { scriptFor } from "../src/simulate.js";
import { FULL_TIME_SECONDS, SECOND_HALF_START_SECONDS, VIRTUAL_TIMING } from "../src/timing.js";

const BASE = Date.UTC(2026, 8, 21, 10, 0, 0);
const OPENING_BALANCE = 2_500_000;

function upcoming(index = 0, ahead = 1): FixtureRef {
  const competition = COMPETITIONS[0];

  if (competition === undefined) throw new Error("no competition");

  const fixture = fixturesForRound(competition, currentRound(competition, BASE) + ahead)[index];

  if (fixture === undefined) throw new Error("no fixture");

  return fixture;
}

let clock = BASE;
let source: MockDataSource;

const at = (fixture: FixtureRef, seconds: number): void => {
  clock = fixture.kickoffMs + seconds * 1000;
};

async function pick(fixture: FixtureRef, marketIndex = 0, selectionIndex = 0): Promise<SlipSelection> {
  const { markets } = await source.getMatchMarkets(fixture.matchId);
  const market = markets[marketIndex];
  const selection = market?.selections[selectionIndex];

  if (market === undefined || selection === undefined) throw new Error("no selection");

  return {
    selectionId: selection.id,
    marketId: market.id,
    matchId: fixture.matchId,
    marketKind: market.kind,
    marketName: market.name,
    selectionLabel: selection.label,
    odds: selection.odds,
    matchLabel: `${fixture.home.name} v ${fixture.away.name}`,
    leagueCode: fixture.competition.seed.code,
    kickoffAt: new Date(fixture.kickoffMs).toISOString(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = BASE;
  source = createMockDataSource({ now: () => clock, latencyMs: 0, openingBalance: OPENING_BALANCE });
  vi.advanceTimersByTime(400);
});

afterEach(() => {
  source.platform.dispose();
  vi.useRealTimers();
});

describe("match state", () => {
  it("reports clock, lifecycle and phase consistently across a match's life", async () => {
    const fixture = upcoming();
    const minuteMs = VIRTUAL_TIMING.secondsPerMinute * 1000;
    const steps = [
      { seconds: -300, status: "SCHEDULED", lifecycle: "FIXTURE_CREATED", phase: "SCHEDULED" },
      { seconds: -100, status: "BETTING_OPEN", lifecycle: "BETTING_OPEN", phase: "BETTING_OPEN" },
      { seconds: -5, status: "BETTING_CLOSED", lifecycle: "BETTING_CLOSED", phase: "BETTING_CLOSED" },
      { seconds: 1, status: "IN_PLAY", lifecycle: "SIMULATION_STARTED", phase: "LIVE", period: "FIRST_HALF", minute: 0, asOf: 0 },
      { seconds: 21.5, status: "IN_PLAY", lifecycle: "EVENTS_PUBLISHED", phase: "LIVE", period: "FIRST_HALF", minute: 10, asOf: 20 },
      { seconds: 95, status: "IN_PLAY", lifecycle: "EVENTS_PUBLISHED", phase: "HALFTIME", period: "HALF_TIME", minute: 45, asOf: 90 },
      { seconds: SECOND_HALF_START_SECONDS + 0.5, status: "IN_PLAY", lifecycle: "EVENTS_PUBLISHED", phase: "LIVE", period: "SECOND_HALF", minute: 45, asOf: SECOND_HALF_START_SECONDS },
      { seconds: SECOND_HALF_START_SECONDS + 23, status: "IN_PLAY", lifecycle: "EVENTS_PUBLISHED", phase: "LIVE", period: "SECOND_HALF", minute: 56, asOf: SECOND_HALF_START_SECONDS + 22 },
      { seconds: FULL_TIME_SECONDS + 1, status: "COMPLETED", lifecycle: "MATCH_FINISHED", phase: "FINISHED", period: "FULL_TIME", minute: 90, asOf: FULL_TIME_SECONDS },
      { seconds: FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds + 1, status: "COMPLETED", lifecycle: "SETTLEMENT_COMPLETED", phase: "SETTLED", period: "FULL_TIME", minute: 90, asOf: FULL_TIME_SECONDS },
    ] as const;

    for (const step of steps) {
      at(fixture, step.seconds);

      const match = await source.getMatch(fixture.matchId);

      expect(match.status, String(step.seconds)).toBe(step.status);
      expect(match.lifecycle).toBe(step.lifecycle);
      expect(match.phase).toBe(step.phase);
      expect(match.phase).toBe(resolvePhase(match.status, { lifecycle: match.lifecycle, period: match.clock?.period }));
      expect(match.updatedAt).toBeDefined();
      expect(Date.parse(match.updatedAt ?? "")).toBeLessThanOrEqual(clock);

      if (!("period" in step)) {
        expect(match.clock).toBeUndefined();
        continue;
      }

      expect(match.clock).toMatchObject({ period: step.period, minute: step.minute, minuteLengthMs: minuteMs });
      expect(Date.parse(match.clock?.asOf ?? "")).toBe(fixture.kickoffMs + step.asOf * 1000);
      expect(displayClock(match.clock, clock)?.minute).toBe(step.minute);
    }
  });

  it("gives a list row the same state as the match itself", async () => {
    const fixture = upcoming();

    at(fixture, 40);

    const [row] = (await source.listMatches({ phases: ["LIVE"] })).filter((m) => m.id === fixture.matchId);
    const match = await source.getMatch(fixture.matchId);

    expect(row).toBeDefined();
    expect(row?.clock).toEqual(match.clock);
    expect(row?.lifecycle).toBe(match.lifecycle);
    expect(match.score).toEqual(match.events.at(-1)?.score);
  });

  it("signals betting closing and settlement completing on the match stream", () => {
    const fixture = upcoming();
    const signals: MatchSignal[] = [];

    at(fixture, -12);

    const subscription = source.subscribeMatch(fixture.matchId, { onEvent: () => undefined, onSignal: (s) => signals.push(s), onConnection: () => undefined });

    at(fixture, -9);
    vi.advanceTimersByTime(300);
    at(fixture, FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds + 1);
    vi.advanceTimersByTime(300);
    subscription.unsubscribe();

    expect(signals[0]).toBe("BETTING_CLOSED");
    expect(signals.at(-1)).toBe("SETTLEMENT_COMPLETED");
  });

  it("groups markets and stops repricing once betting closes", async () => {
    const fixture = upcoming();

    at(fixture, -100);

    const open = await source.getMatchMarkets(fixture.matchId);

    expect(new Set(open.markets.map((m) => m.group))).toEqual(new Set(["MAIN", "GOALS", "SCORE", "HANDICAP"]));
    for (const market of open.markets) {
      expect(market.updatedAt).toBeDefined();
      expect(market.selections.every((s) => s.status === "OPEN")).toBe(true);
    }

    at(fixture, -5);

    const closed = await source.getMatchMarkets(fixture.matchId);

    at(fixture, 120);

    const later = await source.getMatchMarkets(fixture.matchId);

    expect(closed.markets[0]?.status).toBe("SUSPENDED");
    expect(closed.markets[0]?.suspensionReason).toBeDefined();
    expect(later.markets.map((m) => m.selections.map((s) => s.odds))).toEqual(closed.markets.map((m) => m.selections.map((s) => s.odds)));
  });
});

describe("placing a bet", () => {
  it("accepts a bet once per client reference and charges the wallet once", async () => {
    const fixture = upcoming();

    at(fixture, -100);

    const selection = await pick(fixture);
    const input = { selections: [selection], stake: 20_000, clientReference: "ref-accept-1" };
    const first = await source.placeBet(input);
    const second = await source.placeBet(input);

    expect(first.outcome).toBe("ACCEPTED");
    expect(first.clientReference).toBe("ref-accept-1");
    expect(first.bet?.potentialPayout).toBe(estimateReturn(20_000, [selection.odds]));
    expect(first.bet?.legs[0]?.oddsVersion).toBeDefined();
    expect(second).toEqual(first);
    expect(await source.listBets()).toHaveLength(1);
    expect((await source.getWallet()).balance).toBe(OPENING_BALANCE - 20_000);
    expect((await source.listTransactions()).filter((t) => t.type === "BET_STAKE")).toHaveLength(1);

    const other = await source.placeBet({ ...input, clientReference: "ref-accept-2" });

    expect(other.outcome).toBe("ACCEPTED");
    expect(other.bet?.id).not.toBe(first.bet?.id);
    expect((await source.getWallet()).balance).toBe(OPENING_BALANCE - 40_000);
  });

  it("returns a business refusal instead of throwing, and takes no money", async () => {
    const fixture = upcoming();

    at(fixture, -100);

    const selection = await pick(fixture);
    const base = { selections: [selection], stake: 20_000 };

    await expect(source.placeBet({ ...base, stake: 2_400_000 + 200_000, clientReference: "r-funds" })).resolves.toMatchObject({ outcome: "REJECTED", reason: "INSUFFICIENT_FUNDS" });
    await expect(source.placeBet({ ...base, stake: 60_000_000, clientReference: "r-limit" })).resolves.toMatchObject({ outcome: "REJECTED", reason: "STAKE_LIMITED", maxStake: 50_000_000 });
    await expect(source.placeBet({ ...base, stake: 10, clientReference: "r-min" })).resolves.toMatchObject({ outcome: "REJECTED", reason: "INVALID_BET" });
    await expect(source.placeBet({ selections: [{ ...selection, odds: selection.odds + 0.5 }], stake: 20_000, clientReference: "r-odds" })).resolves.toMatchObject({
      outcome: "REJECTED",
      reason: "ODDS_CHANGED",
      rejectedSelectionIds: [selection.selectionId],
    });

    at(fixture, -5);

    const closed = await source.placeBet({ ...base, clientReference: "r-closed" });

    expect(closed).toMatchObject({ outcome: "REJECTED", reason: "MARKET_CLOSED", clientReference: "r-closed", rejectedSelectionIds: [selection.selectionId] });
    expect(closed.message).toMatch(/closed/i);
    expect(closed.bet).toBeUndefined();
    expect(await source.listBets()).toHaveLength(0);
    expect((await source.getWallet()).balance).toBe(OPENING_BALANCE);
  });

  it("rejects the whole slip and names the closed legs when only some are closed", async () => {
    const open = upcoming(0, 1);
    const live = upcoming(0, 0);

    at(open, -100);

    const openLeg = await pick(open);
    const liveLeg = await pick(live);
    const placement = await source.placeBet({ selections: [openLeg, liveLeg], stake: 20_000, clientReference: "r-partial" });

    expect(placement.outcome).toBe("REJECTED");
    expect(placement.reason).toBe("MARKET_CLOSED");
    expect(placement.rejectedSelectionIds).toEqual([liveLeg.selectionId]);
  });

  it("still throws for a request with no client reference", async () => {
    const fixture = upcoming();

    at(fixture, -100);

    const selection = await pick(fixture);

    await expect(source.placeBet({ selections: [selection], stake: 20_000, clientReference: " " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("settles the bet from the final score once the settlement delay has passed", async () => {
    const fixture = upcoming();

    at(fixture, -100);

    const selection = await pick(fixture);
    const { bet } = await source.placeBet({ selections: [selection], stake: 20_000, clientReference: "ref-settle" });

    at(fixture, FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds + 1);
    vi.advanceTimersByTime(1100);

    const settled = await source.getBet(bet?.id ?? "");
    const { finalScore } = scriptFor(fixture);
    const homeWon = finalScore.home > finalScore.away;

    expect(settled.status).toBe(homeWon ? "WON" : "LOST");
    expect(settled.payout).toBe(homeWon ? bet?.potentialPayout : 0);
    expect((await source.getWallet()).balance).toBe(OPENING_BALANCE - 20_000 + (settled.payout ?? 0));
  });
});

describe("wallet", () => {
  it("pages, filters, searches and sorts transactions", async () => {
    const fixture = upcoming();

    at(fixture, -200);

    for (const amount of [100_000, 200_000, 300_000]) {
      await source.deposit(amount);
      clock += 1000;
    }

    const selection = await pick(fixture);

    await source.placeBet({ selections: [selection], stake: 20_000, clientReference: "ref-ledger" });
    clock += 1000;
    await source.withdraw(50_000);

    const firstPage = await source.queryTransactions({ page: 1, pageSize: 2 });
    const thirdPage = await source.queryTransactions({ page: 3, pageSize: 2 });

    expect(firstPage).toMatchObject({ page: 1, pageSize: 2, total: 6 });
    expect(firstPage.items.map((t) => t.type)).toEqual(["WITHDRAWAL", "BET_STAKE"]);
    expect(thirdPage.items).toHaveLength(2);
    expect((await source.queryTransactions({ page: 4, pageSize: 2 })).items).toHaveLength(0);

    const deposits = await source.queryTransactions({ types: ["DEPOSIT"], sort: "amount", direction: "asc" });

    expect(deposits.total).toBe(4);
    expect(deposits.items.map((t) => t.amount)).toEqual([100_000, 200_000, 300_000, OPENING_BALANCE]);

    const pending = await source.queryTransactions({ statuses: ["PENDING"] });

    expect(pending.items.map((t) => t.type)).toEqual(["WITHDRAWAL"]);
    expect((await source.getWallet()).pending).toBe(50_000);

    const stake = await source.queryTransactions({ search: "STAKE" });

    expect(stake.total).toBe(1);
    expect(stake.items[0]).toMatchObject({ type: "BET_STAKE", status: "COMPLETED", currency: "NGN" });
    expect(stake.items[0]?.betId).toBe((await source.listBets())[0]?.id);

    const recent = await source.queryTransactions({ from: new Date(clock - 1500).toISOString() });

    expect(recent.items.map((t) => t.type)).toEqual(["WITHDRAWAL", "BET_STAKE"]);
    expect((await source.queryTransactions({ to: new Date(BASE - 3_600_000).toISOString() })).total).toBe(1);

    clock += 6000;

    expect((await source.queryTransactions({ statuses: ["PENDING"] })).total).toBe(0);
    expect((await source.getWallet()).pending).toBe(0);
  });
});

describe("discovery", () => {
  it("searches teams, leagues and matches without regard to case or accents", async () => {
    const arsenal = await source.search({ term: "ARSENAL" });

    expect(arsenal.term).toBe("ARSENAL");
    expect(arsenal.hits[0]).toMatchObject({ kind: "TEAM", title: "Arsenal" });
    expect(arsenal.hits.some((h) => h.kind === "MATCH" && h.matchId !== undefined)).toBe(true);

    const matchesOnly = await source.search({ term: "arsenal", kinds: ["MATCH"] });

    expect(matchesOnly.hits.length).toBeGreaterThan(0);
    expect(matchesOnly.hits.every((h) => h.kind === "MATCH")).toBe(true);

    expect((await source.search({ term: "atletico", kinds: ["TEAM"] })).hits[0]?.title).toBe("Atlético Madrid");
    expect((await source.search({ term: "serie" })).hits[0]).toMatchObject({ kind: "LEAGUE", title: "Serie A" });
    expect((await source.search({ term: "a" })).hits).toHaveLength(0);
    expect((await source.search({ term: "an", limit: 3 })).hits).toHaveLength(3);
    expect((await source.search({ term: "zzzz" })).hits).toHaveLength(0);
  });

  it("fields eleven starters a side on a grid, confirmed once betting has closed", async () => {
    const fixture = upcoming();

    at(fixture, -100);

    const predicted = await source.getMatchLineups(fixture.matchId);

    expect(predicted.confirmed).toBe(false);

    for (const lineup of [predicted.home, predicted.away]) {
      if (lineup === undefined) throw new Error("no lineup");

      const cells = lineup.starting.map((p) => `${String(p.grid?.row)}:${String(p.grid?.slot)}`);
      const shape = (lineup.formation ?? "").split("-").map(Number);

      expect(lineup.starting).toHaveLength(11);
      expect(new Set(cells).size).toBe(11);
      expect(lineup.starting.filter((p) => p.grid?.row === 1).map((p) => p.position)).toEqual(["GK"]);
      expect(shape.reduce((a, b) => a + b, 0)).toBe(10);
      expect(lineup.starting.filter((p) => p.captain === true)).toHaveLength(1);
      expect(lineup.substitutes.length).toBeGreaterThan(0);
      expect(lineup.manager).toBeDefined();
    }

    at(fixture, -5);
    expect((await source.getMatchLineups(fixture.matchId)).confirmed).toBe(true);

    at(fixture, FULL_TIME_SECONDS + 1);

    const played = await source.getMatchLineups(fixture.matchId);
    const substitutions = scriptFor(fixture).events.filter((e) => e.kind === "SUBSTITUTION" && e.side === "HOME");

    expect(played.home?.formation).toBe(predicted.home?.formation);
    expect(played.home?.starting.filter((p) => p.substitutedMinute !== undefined)).toHaveLength(substitutions.length);
  });

  it("builds head-to-head from earlier meetings of the same two teams", async () => {
    const fixture = upcoming();
    const h2h = await source.getHeadToHead(fixture.matchId);
    const pair = new Set([fixture.home.id, fixture.away.id]);

    expect(h2h.played).toBeGreaterThan(0);
    expect(h2h.played).toBe(h2h.meetings.length);
    expect(h2h.homeWins + h2h.draws + h2h.awayWins).toBe(h2h.played);

    for (const meeting of h2h.meetings) {
      expect(new Set([meeting.home.id, meeting.away.id])).toEqual(pair);
      expect(Date.parse(meeting.kickoffAt)).toBeLessThan(fixture.kickoffMs);
      await expect(source.getMatch(meeting.matchId)).resolves.toMatchObject({ phase: "SETTLED", score: meeting.score });
    }
  });

  it("serves the platform configuration", async () => {
    await expect(source.getPlatformConfig()).resolves.toMatchObject({
      currency: { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" },
      features: { walletEnabled: true, searchEnabled: true },
      stakeLimits: { min: 5_000, max: 50_000_000, maxSelections: 20 },
      competitionTimezone: "Africa/Lagos",
    });
  });
});
