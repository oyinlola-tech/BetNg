import type {
  AccountAnalysis,
  AdminCashierSummary,
  AdminCustomer,
  AdminShopSummary,
  AnalyticsBreakdown,
  AnalyticsBreakdownRow,
  AnalyticsDimension,
  AnalyticsOverview,
  CommissionConfig,
  CommissionSummary,
  MatchExposure,
  OperatorPeriod,
  OperatorSummary,
  RiskLimits,
  SessionAnalysis,
} from "@betng/contracts";
import { estimateReturn, toLocalDateKey } from "@betng/ui-core";
import { COMPETITIONS } from "../clubs.js";
import { rng } from "../prng.js";
import { CYCLE_SECONDS, bettingClosesMs, currentRound, kickoffMs, lifecycleAt, statusAt } from "../season.js";
import { fixtureWindow, marketOddsFor, reportDays, tradable, type Overrides } from "./derive.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MATCHES_PER_DAY = (86_400 / CYCLE_SECONDS) * COMPETITIONS.reduce((acc, c) => acc + c.clubs.length / 2, 0);

export interface Window {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

export interface Directory {
  readonly shops: readonly AdminShopSummary[];
  readonly cashiers: readonly AdminCashierSummary[];
  readonly customers: readonly AdminCustomer[];
}

interface Totals {
  readonly stake: number;
  readonly payouts: number;
  readonly bets: number;
  readonly shopStake: number;
  readonly days: number;
}

const rate = (result: number, stake: number): number => (stake === 0 ? 0 : Math.round((result / stake) * 10_000) / 10_000);

function startOfLocalDay(at: number): number {
  const d = new Date(at);

  d.setHours(0, 0, 0, 0);

  return d.getTime();
}

function bounds(window: Window, now: number, defaultDays = 1): readonly [number, number] {
  const to = window.to === undefined || Number.isNaN(Date.parse(window.to)) ? now : Math.min(now, Date.parse(window.to));
  const from = window.from === undefined || Number.isNaN(Date.parse(window.from)) ? startOfLocalDay(to) - (defaultDays - 1) * DAY_MS : Date.parse(window.from);

  return [Math.min(from, to), to];
}

/** Book totals between two instants, spreading each report day evenly over the part of it that has elapsed. */
function totalsBetween(from: number, to: number, now: number): Totals {
  let stake = 0;
  let payouts = 0;
  let bets = 0;
  let shopStake = 0;
  let days = 0;

  for (const day of reportDays(toLocalDateKey(new Date(from)), toLocalDateKey(new Date(to)), now)) {
    const start = startOfLocalDay(Date.parse(`${day.date}T12:00:00`));
    const end = Math.min(start + DAY_MS, now);
    const share = end <= start ? 0 : Math.max(0, Math.min(to, end) - Math.max(from, start)) / (end - start);

    stake += Math.round(day.stake * share);
    payouts += Math.round(day.payouts * share);
    bets += Math.round(day.bets * share);
    shopStake += Math.round(day.shopStake * share);
    days += (share * (end - start)) / DAY_MS;
  }

  return { stake, payouts, bets, shopStake, days };
}

export function analyticsOverview(window: Window, directory: Directory, now: number): AnalyticsOverview {
  const [from, to] = bounds(window, now);
  const totals = totalsBetween(from, to, now);
  const live = to >= now - HOUR_MS;
  const pendingBets = live ? Math.round(totals.bets * 0.04) : 0;
  const settledBets = totals.bets - pendingBets;
  const winningBets = Math.round(settledBets * 0.36);
  const voidBets = Math.round(settledBets * 0.01);
  const cancelledBets = Math.round(settledBets * 0.004);
  const limitedBets = Math.round(totals.bets * 0.021);
  const rejectedBets = Math.round(totals.bets * 0.008);
  const pendingStake = totals.bets === 0 ? 0 : Math.round((totals.stake * pendingBets) / totals.bets);
  const settledStake = totals.stake - pendingStake;
  const totalPayout = Math.min(totals.payouts, Math.round(settledStake * 0.98));

  return {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    totalMatches: Math.round(totals.days * MATCHES_PER_DAY),
    totalBets: totals.bets + rejectedBets,
    acceptedBets: totals.bets - limitedBets,
    limitedBets,
    rejectedBets,
    pendingBets,
    settledBets,
    winningBets,
    losingBets: settledBets - winningBets - voidBets - cancelledBets,
    voidBets,
    cancelledBets,
    totalStake: totals.stake,
    pendingStake,
    settledStake,
    totalPayout,
    operatorResult: settledStake - totalPayout,
    operatorResultRate: rate(settledStake - totalPayout, settledStake),
    customers: directory.customers.length * 43,
    shops: directory.shops.length,
    cashiers: directory.cashiers.length,
    generatedAt: new Date(now).toISOString(),
  };
}

export interface BreakdownQuery extends Window {
  readonly by: AnalyticsDimension;
  readonly leagueId?: string | undefined;
  readonly matchId?: string | undefined;
  readonly shopId?: string | undefined;
  readonly limit?: number | undefined;
}

const MARKET_KEYS: readonly (readonly [string, string])[] = [
  ["MATCH_RESULT", "Match Result"],
  ["DOUBLE_CHANCE", "Double Chance"],
  ["OVER_UNDER", "Total Goals"],
  ["BOTH_TEAMS_TO_SCORE", "Both Teams To Score"],
  ["CORRECT_SCORE", "Correct Score"],
  ["GOAL_SPREAD", "Goal Spread"],
];
const SELECTION_KEYS: readonly (readonly [string, string])[] = [
  ["HOME", "Home win"],
  ["DRAW", "Draw"],
  ["AWAY", "Away win"],
  ["OVER_2_5", "Over 2.5"],
  ["UNDER_2_5", "Under 2.5"],
  ["YES", "Both teams to score"],
  ["NO", "Not both teams to score"],
];

function breakdownKeys(query: BreakdownQuery, directory: Directory, from: number, to: number, now: number): readonly (readonly [string, string])[] {
  switch (query.by) {
    case "league":
      return COMPETITIONS.filter((c) => query.leagueId === undefined || c.id === query.leagueId).map((c) => [c.id, c.seed.name] as const);
    case "match":
      return fixtureWindow(now, 3, 0, query.leagueId)
        .filter((f) => query.matchId === undefined || f.matchId === query.matchId)
        .map((f) => [f.matchId, `${f.home.name} v ${f.away.name}`] as const);
    case "market":
      return MARKET_KEYS;
    case "selection":
      return SELECTION_KEYS;
    case "shop":
      return directory.shops.filter((s) => query.shopId === undefined || s.id === query.shopId).map((s) => [s.id, s.name] as const);
    case "cashier":
      return directory.cashiers.filter((c) => query.shopId === undefined || c.shopId === query.shopId).map((c) => [c.id, c.displayName] as const);
    case "customer":
      return directory.customers.map((c) => [c.id, c.displayName] as const);
    case "channel":
      return [
        ["ONLINE", "Online"],
        ["SHOP", "Shop"],
      ];
    case "hour":
      return Array.from({ length: 24 }, (_, h) => [String(h).padStart(2, "0"), `${String(h).padStart(2, "0")}:00`] as const);
    case "day": {
      const keys: (readonly [string, string])[] = [];

      for (let t = startOfLocalDay(from); t <= to && keys.length < 120; t += DAY_MS) {
        const key = toLocalDateKey(new Date(t + DAY_MS / 2));

        keys.push([key, key]);
      }

      return keys;
    }
  }
}

export function analyticsBreakdown(query: BreakdownQuery, directory: Directory, now: number): AnalyticsBreakdown {
  const [from, to] = bounds(query, now);
  const totals = totalsBetween(from, to, now);
  const keys = breakdownKeys(query, directory, from, to, now);
  const overShops = query.by === "shop" || query.by === "cashier";
  const stakePool = overShops ? totals.shopStake : query.by === "customer" ? totals.stake - totals.shopStake : totals.stake;
  const betPool = totals.stake === 0 ? 0 : Math.round((totals.bets * stakePool) / totals.stake);
  const live = to >= now - HOUR_MS;
  const weights = keys.map(([key]) => 0.2 + rng(`breakdown:${query.by}:${key}`).next());
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;

  const dayTotals = (dateKey: string): Totals => {
    const start = startOfLocalDay(Date.parse(`${dateKey}T12:00:00`));

    return totalsBetween(Math.max(from, start), Math.min(to, start + DAY_MS), now);
  };

  const items = keys.map(([key, label], index): AnalyticsBreakdownRow => {
    const r = rng(`breakdown-row:${query.by}:${key}`);
    const share = (weights[index] ?? 0) / weightTotal;
    const day = query.by === "day" ? dayTotals(key) : undefined;
    const stake = day?.stake ?? Math.round((stakePool * share) / 100) * 100;
    const bets = day?.bets ?? Math.round(betPool * share);
    const pendingBets = live ? Math.round(bets * 0.04) : 0;
    const settled = bets - pendingBets;
    const winningBets = Math.round(settled * (0.3 + r.next() * 0.12));
    const voidBets = Math.round(settled * 0.01);
    const pendingStake = bets === 0 ? 0 : Math.round((stake * pendingBets) / bets);
    const payout = Math.round((stake - pendingStake) * (0.78 + r.next() * 0.2));
    const operatorResult = stake - pendingStake - payout;

    return {
      key,
      label,
      bets,
      pendingBets,
      winningBets,
      losingBets: settled - winningBets - voidBets,
      voidBets,
      stake,
      payout,
      pendingLiability: Math.round(pendingStake * (2.2 + r.next() * 1.6)),
      operatorResult,
      operatorResultRate: rate(operatorResult, stake - pendingStake),
    };
  });

  const ordered = query.by === "hour" || query.by === "day" ? items : [...items].sort((a, b) => b.stake - a.stake);

  return { by: query.by, from: new Date(from).toISOString(), to: new Date(to).toISOString(), items: ordered.slice(0, Math.min(500, Math.max(1, query.limit ?? 100))) };
}

export interface SessionQuery extends Window {
  readonly kind: SessionAnalysis["kind"];
  readonly leagueId?: string | undefined;
}

function sessionOver(sessionId: string, kind: SessionAnalysis["kind"], label: string, from: number, to: number, scale: number, directory: Directory, now: number): SessionAnalysis {
  const totals = totalsBetween(from, Math.min(to, now), now);
  const r = rng(`session:${sessionId}`);
  const stake = Math.round((totals.stake * scale) / 100) * 100;
  const payout = Math.round(stake * (0.78 + r.next() * 0.2));
  const bets = Math.round(totals.bets * scale);

  return {
    sessionId,
    kind,
    label,
    startsAt: new Date(from).toISOString(),
    endsAt: new Date(to).toISOString(),
    bets,
    stake,
    payout,
    operatorResult: stake - payout,
    operatorResultRate: rate(stake - payout, stake),
    customers: Math.round(bets * 0.62),
    shops: directory.shops.filter((s) => s.status === "ACTIVE").length,
    cashiers: directory.cashiers.filter((c) => c.status === "ACTIVE").length,
    markets: Math.round(totals.days * MATCHES_PER_DAY * scale) * 8,
    matches: Math.round(totals.days * MATCHES_PER_DAY * scale),
  };
}

export function analyticsSessions(query: SessionQuery, directory: Directory, now: number): readonly SessionAnalysis[] {
  const out: SessionAnalysis[] = [];

  if (query.kind === "CUSTOM") {
    const [from, to] = bounds(query, now);

    return [sessionOver(`custom-${String(from)}`, "CUSTOM", "Selected window", from, to, 1, directory, now)];
  }

  if (query.kind === "HOUR" || query.kind === "DAY") {
    const step = query.kind === "HOUR" ? HOUR_MS : DAY_MS;
    const [from, to] = bounds(query, now, query.kind === "HOUR" ? 1 : 7);
    const first = query.kind === "HOUR" ? Math.floor(from / HOUR_MS) * HOUR_MS : startOfLocalDay(from);

    for (let t = first; t <= to && out.length < 200; t += step) {
      const at = new Date(t);
      const label = query.kind === "HOUR" ? `${toLocalDateKey(at)} ${String(at.getHours()).padStart(2, "0")}:00` : toLocalDateKey(new Date(t + DAY_MS / 2));

      out.push(sessionOver(`${query.kind.toLowerCase()}-${String(t)}`, query.kind, label, t, t + step, 1, directory, now));
    }

    return out.reverse();
  }

  for (const competition of COMPETITIONS) {
    if (query.leagueId !== undefined && competition.id !== query.leagueId) continue;

    const current = currentRound(competition, now);
    const share = competition.clubs.length / 2 / (MATCHES_PER_DAY / (86_400 / CYCLE_SECONDS));

    for (let round = current; round > current - 8 && round >= 0; round -= 1) {
      const kickoff = kickoffMs(competition, round);
      const matchday = (round % competition.matchdays) + 1;

      out.push(
        sessionOver(
          `${query.kind.toLowerCase()}-${competition.seed.key}-${String(round)}`,
          query.kind,
          `${competition.seed.code} · Matchday ${String(matchday)}`,
          kickoff - CYCLE_SECONDS * 1000,
          kickoff,
          share,
          directory,
          now,
        ),
      );
    }
  }

  return out.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export function accountAnalysis(kind: "accounts" | "shops" | "cashiers", id: string, directory: Directory, commissionPercent: number): AccountAnalysis | undefined {
  const r = rng(`account-analysis:${id}`);
  const build = (subjectKind: AccountAnalysis["subjectKind"], label: string, stake: number, payout: number, pendingBets: number, commission?: number): AccountAnalysis => {
    const bets = Math.max(pendingBets, Math.round(stake / 85_000));
    const settled = bets - pendingBets;
    const wins = Math.round(settled * (0.3 + r.next() * 0.12));
    const voids = Math.round(settled * 0.01);

    return {
      subjectKind,
      subjectId: id,
      label,
      bets,
      pendingBets,
      wins,
      losses: settled - wins - voids,
      voids,
      stake,
      payout,
      netResult: payout - stake,
      operatorContribution: stake - payout,
      ...(commission === undefined ? {} : { commission }),
      transactions: bets + wins,
    };
  };

  if (kind === "accounts") {
    const customer = directory.customers.find((c) => c.id === id);

    return customer === undefined ? undefined : build("CUSTOMER", customer.displayName, customer.lifetimeStake, customer.lifetimePayout, customer.openBets);
  }

  if (kind === "shops") {
    const shop = directory.shops.find((s) => s.id === id);

    if (shop === undefined) return undefined;

    const stake = shop.todaySales * 30;
    const payout = shop.todayPayouts * 30;

    return build("SHOP", shop.name, stake, payout, shop.openTickets, Math.max(0, Math.round(((stake - payout) * commissionPercent) / 100)));
  }

  const cashier = directory.cashiers.find((c) => c.id === id);

  return cashier === undefined ? undefined : build("CASHIER", cashier.displayName, cashier.todaySales, Math.round(cashier.todaySales * (0.6 + r.next() * 0.35)), Math.round(cashier.todayTransactions * 0.2));
}

const SEEDED_PERIOD_DAYS = 7;

function periodBoundaries(closes: readonly string[], now: number): readonly number[] {
  const today = startOfLocalDay(now);
  const oldest = today - (SEEDED_PERIOD_DAYS - 1) * DAY_MS;
  const midnights = Array.from({ length: SEEDED_PERIOD_DAYS }, (_, i) => startOfLocalDay(oldest + i * DAY_MS + DAY_MS / 2));
  const manual = closes.map((c) => Date.parse(c)).filter((t) => t > oldest && t <= now);

  return [...new Set([...midnights, ...manual])].sort((a, b) => a - b);
}

export function operatorPeriods(closes: readonly string[], now: number): readonly OperatorPeriod[] {
  const edges = periodBoundaries(closes, now);
  const sequences = new Map<string, number>();

  return edges
    .map((startsAt, index): OperatorPeriod => {
      const endsAt = edges[index + 1];
      const dateKey = new Date(startsAt).toISOString().slice(0, 10).replaceAll("-", "");
      const sequence = (sequences.get(dateKey) ?? 0) + 1;
      const wholeDay = endsAt !== undefined && endsAt - startsAt >= DAY_MS - HOUR_MS;

      sequences.set(dateKey, sequence);

      return {
        id: `SESSION-${dateKey}-${String(sequence).padStart(4, "0")}`,
        kind: wholeDay ? "DAY" : "CUSTOM",
        status: endsAt === undefined ? "OPEN" : "CLOSED",
        startsAt: new Date(startsAt).toISOString(),
        ...(endsAt === undefined ? {} : { endsAt: new Date(endsAt).toISOString() }),
      };
    })
    .reverse();
}

export function operatorSummary(period: OperatorPeriod, now: number): OperatorSummary {
  const totals = totalsBetween(Date.parse(period.startsAt), period.endsAt === undefined ? now : Date.parse(period.endsAt), now);

  return {
    period,
    grossStakes: totals.stake,
    grossPayouts: totals.payouts,
    operatorResult: totals.stake - totals.payouts,
    operatorResultRate: rate(totals.stake - totals.payouts, totals.stake),
    settledBets: Math.round(totals.bets * 0.96),
    voidBets: Math.round(totals.bets * 0.01),
    refundedStakes: Math.round((totals.stake * 0.01) / 100) * 100,
  };
}

export function commissionFor(period: OperatorPeriod, shops: readonly AdminShopSummary[], configs: readonly CommissionConfig[], fallback: CommissionConfig, now: number): readonly CommissionSummary[] {
  const end = period.endsAt === undefined ? now : Date.parse(period.endsAt);
  const totals = totalsBetween(Date.parse(period.startsAt), end, now);
  const weights = shops.map((s) => (s.status === "SUSPENDED" ? 0 : 0.2 + rng(`commission:${s.id}`).next()));
  const weightTotal = weights.reduce((a, b) => a + b, 0) || 1;

  return shops.map((shop, index): CommissionSummary => {
    const r = rng(`commission:${period.id}:${shop.id}`);
    const grossStakes = Math.round((totals.shopStake * (weights[index] ?? 0)) / weightTotal / 100) * 100;
    const grossPayouts = Math.round(grossStakes * (0.74 + r.next() * 0.3));
    const result = grossStakes - grossPayouts;
    const shopSharePercent = (configs.find((c) => c.shopId === shop.id) ?? fallback).shopSharePercent;
    // A shop shares in a positive result only; a losing period is carried by the platform.
    const shopShareAmount = Math.max(0, Math.round((result * shopSharePercent) / 100));

    return {
      periodId: period.id,
      shopId: shop.id,
      shopName: shop.name,
      grossStakes,
      grossPayouts,
      grossOperatorResult: result,
      shopSharePercent,
      shopShareAmount,
      platformSharePercent: 100 - shopSharePercent,
      platformShareAmount: result - shopShareAmount,
      createdAt: new Date(end).toISOString(),
    };
  });
}

type ExposureStatus = MatchExposure["status"];

const exposureStatus = (exposure: number, limit: number): ExposureStatus => (exposure > limit * 0.85 ? "CRITICAL" : exposure > limit * 0.55 ? "ELEVATED" : "NORMAL");

export function exposureBoard(now: number, overrides: Overrides, limits: RiskLimits): readonly MatchExposure[] {
  return fixtureWindow(now, 1, 1)
    .filter((f) => tradable(f, now))
    .map((f): MatchExposure => {
      const frozen = statusAt(f, now) !== "BETTING_OPEN";
      let bets = 0;

      const markets = marketOddsFor(f, now, overrides).map((market) => {
        const totalStake = market.selections.reduce((acc, s) => acc + s.stake, 0);
        const selections = market.selections.map((s) => {
          const count = Math.round(s.stake / 85_000);
          const potentialPayout = estimateReturn(s.stake, [s.currentOdds]);
          const netExposure = potentialPayout - totalStake;

          bets += count;

          return {
            selectionId: s.selectionId,
            code: s.label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 32),
            label: s.label,
            odds: s.currentOdds,
            bets: count,
            customers: Math.round(count * 0.8),
            shops: Math.min(14, Math.round(count * 0.1)),
            totalStake: s.stake,
            potentialPayout,
            netExposure,
            status: frozen ? ("FROZEN" as const) : exposureStatus(netExposure, limits.maxLiabilityPerSelection),
          };
        });

        return { marketId: market.marketId, type: market.marketType, totalStake, worstCaseExposure: Math.max(0, ...selections.map((s) => s.netExposure)), selections };
      });
      const worstCaseExposure = markets.reduce((acc, m) => acc + m.worstCaseExposure, 0);

      return {
        matchId: f.matchId,
        leagueName: f.competition.seed.name,
        matchLabel: `${f.home.name} v ${f.away.name}`,
        kickoffAt: new Date(f.kickoffMs).toISOString(),
        lifecycle: lifecycleAt(f, now),
        ...(frozen ? { frozenAt: new Date(bettingClosesMs(f)).toISOString() } : {}),
        bets,
        totalStake: markets.reduce((acc, m) => acc + m.totalStake, 0),
        worstCaseExposure,
        status: frozen ? "FROZEN" : exposureStatus(worstCaseExposure, limits.maxLiabilityPerMatch),
        markets,
      };
    })
    .sort((a, b) => b.worstCaseExposure - a.worstCaseExposure);
}
