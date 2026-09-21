import type {
  AdminFixture,
  AdminMarketOdds,
  AdminSettlement,
  AdminSimulationRun,
  PlatformLedgerEntry,
  PlatformReportDay,
  RiskOverview,
  RiskState,
  ServiceHealth,
} from "@betng/contracts";
import { estimateReturn, toLocalDateKey } from "@betng/ui-core";
import { COMPETITIONS } from "../clubs.js";
import { marketsFor } from "../markets.js";
import { hash, rng } from "../prng.js";
import { CYCLE_SECONDS, currentRound, fixturesForRound, statusAt, type FixtureRef } from "../season.js";
import { releasedEvents, scriptFor } from "../simulate.js";
import { FULL_TIME_SECONDS, VIRTUAL_TIMING } from "../timing.js";
import { SERVICES } from "./seed.js";

export interface MatchOverride {
  betting?: "OPEN" | "CLOSED";
  voided?: boolean;
  simulationRetried?: boolean;
  simulationCancelled?: boolean;
}

export interface Overrides {
  readonly matches: Readonly<Record<string, MatchOverride>>;
  readonly markets: Readonly<Record<string, "SUSPENDED" | "OPEN">>;
  readonly settlements: Readonly<Record<string, number>>;
}

export function fixtureWindow(now: number, back = 3, ahead = 2, leagueId?: string): readonly FixtureRef[] {
  const out: FixtureRef[] = [];

  for (const competition of COMPETITIONS) {
    if (leagueId !== undefined && competition.id !== leagueId) continue;

    const current = currentRound(competition, now);

    for (let round = current - back; round <= current + ahead; round += 1) out.push(...fixturesForRound(competition, round));
  }

  return out.sort((a, b) => a.kickoffMs - b.kickoffMs);
}

const label = (f: FixtureRef): string => `${f.home.name} v ${f.away.name}`;
const simulationFails = (f: FixtureRef): boolean => hash(`simfail:${f.matchId}`) % 11 === 0;
const settlementFails = (betKey: string): boolean => hash(`settlefail:${betKey}`) % 19 === 0;

function scoreAt(f: FixtureRef, now: number): { readonly home: number; readonly away: number; readonly events: number } {
  const script = scriptFor(f);
  const elapsed = (now - f.kickoffMs) / 1000;

  if (elapsed >= FULL_TIME_SECONDS) return { ...script.finalScore, events: script.events.length };

  const released = releasedEvents(script, elapsed);

  return { ...(released.at(-1)?.score ?? { home: 0, away: 0 }), events: released.length };
}

export function toAdminFixture(f: FixtureRef, now: number, overrides: Overrides): AdminFixture {
  const status = statusAt(f, now);
  const o = overrides.matches[f.matchId] ?? {};
  const voided = o.voided === true;
  const settledAfter = f.kickoffMs + (FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds) * 1000;
  const score = scoreAt(f, now);

  return {
    matchId: f.matchId,
    leagueId: f.competition.id,
    leagueName: f.competition.seed.name,
    season: f.season,
    matchday: f.matchday,
    homeName: f.home.name,
    awayName: f.away.name,
    kickoffAt: new Date(f.kickoffMs).toISOString(),
    score: { home: score.home, away: score.away },
    matchStatus: voided ? "CANCELLED" : status,
    bettingStatus: voided ? "CLOSED" : status === "SCHEDULED" ? "NOT_OPEN" : status === "BETTING_OPEN" ? (o.betting === "CLOSED" ? "SUSPENDED" : "OPEN") : "CLOSED",
    simulationStatus:
      status === "COMPLETED"
        ? "COMPLETED"
        : status === "IN_PLAY"
          ? "RUNNING"
          : simulationFails(f) && o.simulationRetried !== true
            ? "FAILED"
            : status === "SCHEDULED" || o.simulationCancelled === true
              ? "QUEUED"
              : "READY",
    settlementStatus: voided ? "VOIDED" : status !== "COMPLETED" ? "NOT_DUE" : now < settledAfter ? "PENDING" : "COMPLETED",
  };
}

export function toSimulationRun(f: FixtureRef, now: number, overrides: Overrides): AdminSimulationRun {
  const fixture = toAdminFixture(f, now, overrides);
  const score = scoreAt(f, now);
  const started = fixture.simulationStatus === "RUNNING" || fixture.simulationStatus === "COMPLETED";

  return {
    id: `sim-${f.matchId.slice(0, 8)}`,
    matchId: f.matchId,
    status: fixture.simulationStatus,
    ...(started ? { startedAt: fixture.kickoffAt } : {}),
    ...(fixture.simulationStatus === "COMPLETED" ? { completedAt: new Date(f.kickoffMs + FULL_TIME_SECONDS * 1000).toISOString() } : {}),
    events: score.events,
    score: { home: score.home, away: score.away },
    seed: `s${String(f.season)}-md${String(f.matchday)}-${hash(f.matchId).toString(16)}`,
    matchLabel: label(f),
    leagueName: f.competition.seed.name,
    ...(fixture.simulationStatus === "FAILED" ? { error: hash(f.matchId) % 2 === 0 ? "Worker timed out after 30s while preparing the event script." : "Probability service answered 503; run not prepared." } : {}),
  };
}

export function marketOddsFor(f: FixtureRef, now: number, overrides: Overrides): readonly AdminMarketOdds[] {
  const status = statusAt(f, now);
  const openedAt = f.kickoffMs - CYCLE_SECONDS * 1000;
  const current = marketsFor(f, Math.min(now, f.kickoffMs - 1));
  const opening = marketsFor(f, openedAt);
  // Stakes build up over the betting window and stop at kick-off.
  const progress = Math.max(0, Math.min(1, (now - openedAt) / (CYCLE_SECONDS * 1000)));
  const matchOverride = overrides.matches[f.matchId] ?? {};

  return current.markets.map((market, index): AdminMarketOdds => {
    const r = rng(`exposure:${market.id}`);
    const pool = r.int(40, 900) * 10_000 * (market.kind === "MATCH_RESULT" ? 4 : 1) * progress;
    const skew = market.selections.map((s) => s.probability * (0.6 + r.next() * 0.9));
    const skewTotal = skew.reduce((a, b) => a + b, 0) || 1;
    const stakes = skew.map((w) => Math.round((pool * w) / skewTotal / 100) * 100);
    const marketStake = stakes.reduce((a, b) => a + b, 0);
    const selections = market.selections.map((s, i) => {
      const stake = stakes[i] ?? 0;

      return {
        selectionId: s.id,
        label: s.label,
        currentOdds: s.odds,
        openingOdds: opening.markets[index]?.selections[i]?.odds ?? s.odds,
        modelProbability: s.probability,
        stake,
        liability: Math.max(0, estimateReturn(stake, [s.odds]) - marketStake),
      };
    });
    const suspended = overrides.markets[market.id] === "SUSPENDED" || matchOverride.betting === "CLOSED" || matchOverride.voided === true;

    return {
      marketId: market.id,
      matchId: f.matchId,
      matchLabel: label(f),
      leagueName: f.competition.seed.name,
      marketType: market.kind,
      marketLabel: market.name,
      status: status === "COMPLETED" ? "SETTLED" : status === "BETTING_OPEN" && !suspended ? "OPEN" : "SUSPENDED",
      margin: Math.round((market.selections.reduce((acc, s) => acc + 1 / s.odds, 0) - 1) * 1000) / 1000,
      exposure: Math.max(0, ...selections.map((s) => s.liability)),
      selections,
      updatedAt: new Date(Math.floor(now / 45_000) * 45_000).toISOString(),
    };
  });
}

const tradable = (f: FixtureRef, now: number): boolean => {
  const status = statusAt(f, now);

  return status === "BETTING_OPEN" || status === "BETTING_CLOSED" || status === "IN_PLAY";
};

export function tradingMarkets(now: number, overrides: Overrides): readonly AdminMarketOdds[] {
  return fixtureWindow(now, 1, 1)
    .filter((f) => tradable(f, now))
    .flatMap((f) => marketOddsFor(f, now, overrides));
}

const riskState = (exposure: number, limit: number): RiskState => (exposure > limit * 0.85 ? "CRITICAL" : exposure > limit * 0.55 ? "ELEVATED" : "NORMAL");

export function riskOverview(now: number, overrides: Overrides, exposureLimit: number): RiskOverview {
  const fixtures = fixtureWindow(now, 1, 1).filter((f) => tradable(f, now));
  const perMatchLimit = exposureLimit / 12;
  const byMarket = new Map<string, { marketType: string; marketLabel: string; stake: number; exposure: number }>();
  let totalStake = 0;
  let potentialPayout = 0;
  let exposure = 0;

  const byMatch = fixtures.map((f) => {
    const markets = marketOddsFor(f, now, overrides);
    let stake = 0;
    let matchExposure = 0;

    for (const market of markets) {
      const marketStake = market.selections.reduce((acc, s) => acc + s.stake, 0);
      const group = byMarket.get(market.marketType) ?? { marketType: market.marketType, marketLabel: market.marketLabel.replace(/\s-?[\d.]+$/, ""), stake: 0, exposure: 0 };

      group.stake += marketStake;
      group.exposure += market.exposure;
      byMarket.set(market.marketType, group);
      stake += marketStake;
      matchExposure += market.exposure;
      potentialPayout += Math.max(0, ...market.selections.map((s) => estimateReturn(s.stake, [s.currentOdds])));
    }

    totalStake += stake;
    exposure += matchExposure;

    return { matchId: f.matchId, matchLabel: label(f), leagueName: f.competition.seed.name, kickoffAt: new Date(f.kickoffMs).toISOString(), stake, exposure: matchExposure, state: riskState(matchExposure, perMatchLimit) };
  });

  const day = rng(`decisions:${toLocalDateKey(new Date(now))}`);
  const dayProgress = ((now / 1000) % 86_400) / 86_400;

  return {
    totalStake,
    potentialPayout,
    exposure,
    exposureLimit,
    state: riskState(exposure, exposureLimit),
    decisions: { accepted: Math.round(day.int(14_000, 22_000) * dayProgress), limited: Math.round(day.int(240, 520) * dayProgress), rejected: Math.round(day.int(60, 180) * dayProgress) },
    byMarket: [...byMarket.values()].sort((a, b) => b.exposure - a.exposure),
    byMatch: byMatch.sort((a, b) => b.exposure - a.exposure),
    generatedAt: new Date(now).toISOString(),
  };
}

const OWNERS = ["Chinedu O.", "Aisha B.", "Emeka N.", "Funke A.", "Yusuf D.", "Kemi L.", "Tobi E.", "Zainab Y."];
const SHOP_CODES = ["BNG-LAG-001", "BNG-LAG-002", "BNG-ABJ-001", "BNG-PHC-001", "BNG-KAN-001", "BNG-IBD-001"];

export function settlementsFor(now: number, overrides: Overrides): readonly AdminSettlement[] {
  const out: AdminSettlement[] = [];

  for (const f of fixtureWindow(now, 3, 0)) {
    if (statusAt(f, now) !== "COMPLETED") continue;

    const fixture = toAdminFixture(f, now, overrides);
    const script = scriptFor(f);
    const r = rng(`settlements:${f.matchId}`);
    const count = r.int(2, 4);

    for (let i = 0; i < count; i += 1) {
      const key = `${f.matchId}:${String(i)}`;
      const id = `stl-${hash(key).toString(16).padStart(8, "0")}`;
      const shop = r.chance(0.4);
      const stake = r.int(5, 400) * 10_000;
      const won = r.chance(0.38);
      const retriedAt = overrides.settlements[id];
      const failed = settlementFails(key) && retriedAt === undefined;
      const status = fixture.settlementStatus === "VOIDED" ? "VOIDED" : fixture.settlementStatus === "PENDING" ? "PENDING" : failed ? "FAILED" : "COMPLETED";

      out.push({
        id,
        betId: `bet-${hash(`bet:${key}`).toString(16).padStart(8, "0")}`,
        ...(shop ? { ticketCode: `BNG-${hash(`ticket:${key}`).toString(36).toUpperCase().slice(0, 6)}` } : {}),
        owner: shop ? `shop:${r.pick(SHOP_CODES)}` : `user:${r.pick(OWNERS)}`,
        channel: shop ? "SHOP" : "ONLINE",
        matchLabel: label(f),
        result: `${String(script.finalScore.home)}–${String(script.finalScore.away)}`,
        stake,
        payout: status === "VOIDED" ? stake : status === "COMPLETED" && won ? Math.round(stake * (1.4 + r.next() * 4)) : 0,
        status,
        ...(status === "FAILED" ? { error: "Wallet credit timed out; ledger entry not written." } : {}),
        timestamp: new Date(retriedAt ?? f.kickoffMs + (FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds) * 1000).toISOString(),
      });
    }
  }

  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function ledgerEntries(now: number): PlatformLedgerEntry[] {
  const types = ["STAKE", "STAKE", "STAKE", "PAYOUT", "DEPOSIT", "WITHDRAWAL", "REFUND"] as const;

  return Array.from({ length: 60 }, (_, index): PlatformLedgerEntry => {
    const slot = Math.floor(now / 30_000) - index;
    const r = rng(`ledger:${String(slot)}`);
    const type = r.pick(types);
    const shop = r.chance(0.35) && type !== "DEPOSIT" && type !== "WITHDRAWAL";
    const amount = r.int(5, type === "PAYOUT" ? 1500 : 400) * 10_000;

    return {
      id: `led-${hash(`ledger:${String(slot)}`).toString(16).padStart(8, "0")}`,
      owner: shop ? `shop:${r.pick(SHOP_CODES)}` : `user:${r.pick(OWNERS)}`,
      channel: shop ? "SHOP" : "ONLINE",
      type,
      amount: type === "STAKE" || type === "WITHDRAWAL" ? -amount : amount,
      reference: `${type === "STAKE" || type === "PAYOUT" || type === "REFUND" ? "bet" : "pay"}-${hash(`ref:${String(slot)}`).toString(16).slice(0, 8)}`,
      createdAt: new Date(slot * 30_000 + r.int(0, 29) * 1000).toISOString(),
    };
  });
}

export function reportDays(from: string, to: string, now: number): readonly PlatformReportDay[] {
  const out: PlatformReportDay[] = [];
  const today = toLocalDateKey(new Date(now));
  const end = Date.parse(`${to}T12:00:00`);

  for (let t = Date.parse(`${from}T12:00:00`); t <= end && out.length < 120; t += 86_400_000) {
    const date = toLocalDateKey(new Date(t));

    if (date > today) break;

    const r = rng(`report:${date}`);
    const weekend = [0, 5, 6].includes(new Date(t).getDay()) ? 1.35 : 1;
    const local = new Date(now);
    const progress = date === today ? Math.max(0.04, (local.getHours() * 60 + local.getMinutes()) / 1440) : 1;
    const stake = Math.round(r.int(3_800, 6_200) * 1_000_000 * weekend * progress);
    const payouts = Math.round(stake * (0.78 + r.next() * 0.2));
    const shopStake = Math.round(stake * (0.34 + r.next() * 0.12));

    out.push({ date, stake, payouts, net: stake - payouts, bets: Math.round((stake / 100 / 850) * (0.9 + r.next() * 0.2)), onlineStake: stake - shopStake, shopStake });
  }

  return out;
}

const VERSIONS: Readonly<Record<string, string>> = { gateway: "1.8.2", match: "1.6.0", betting: "1.9.4", wallet: "1.5.1", settlement: "1.4.3", odds: "0.9.7", risk: "0.8.2", simulation: "0.11.0", event: "1.3.5", scheduler: "1.1.0", analytics: "0.4.1" };
const BASE_LATENCY: Readonly<Record<string, number>> = { gateway: 12, match: 24, betting: 31, wallet: 28, settlement: 36, odds: 190, risk: 64, simulation: 88, event: 9, scheduler: 15, analytics: 120 };

export function serviceHealth(now: number): readonly ServiceHealth[] {
  const bucket = Math.floor(now / 5000);

  return SERVICES.map((service): ServiceHealth => {
    const jitter = (hash(`${service}:${String(bucket)}`) % 100) / 100;
    const base = BASE_LATENCY[service] ?? 30;
    // Analytics drops out for 45 seconds in every five minutes so the offline state is always reachable.
    const offline = service === "analytics" && Math.floor(now / 1000) % 300 < 45;
    const latencyMs = offline ? 0 : Math.round(base * (0.8 + jitter * 0.6));
    const degraded = service === "odds" || (service === "settlement" && jitter > 0.92);

    return {
      service,
      status: offline ? "unavailable" : degraded ? "degraded" : "ok",
      latencyMs,
      version: VERSIONS[service] ?? "1.0.0",
      checkedAt: new Date(offline ? now - ((Math.floor(now / 1000) % 300) + 1) * 1000 : bucket * 5000).toISOString(),
    };
  });
}
