import type { Cashier, MarketId, MatchId, SelectionId, Ticket, TicketId, TicketSelection } from "@betng/contracts";
import { FULL_TIME_SECONDS, VIRTUAL_TIMING, formatScore, toLocalDateKey, type MarketKind } from "@betng/ui-core";
import { COMPETITIONS } from "../clubs.js";
import { marketsFor, settleSelection } from "../markets.js";
import { rng, uuidFrom, type Rng } from "../prng.js";
import { currentRound, fixturesForRound, type FixtureRef } from "../season.js";
import { scriptFor } from "../simulate.js";
import { COUNTER_STAFF, CUSTOMERS, SHOP, SHOP_ID, TICKET_EXPIRY_DAYS } from "./directory.js";

const DAY_MS = 86_400_000;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function ticketCode(random: Rng): string {
  let code = "";

  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[random.int(0, CODE_ALPHABET.length - 1)] as string;

  return `BNG-${code}`;
}

export function expiryFor(placedAtMs: number): string {
  return new Date(placedAtMs + TICKET_EXPIRY_DAYS * DAY_MS).toISOString();
}

function startOfLocalDay(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];

  return new Date(y, m - 1, d).getTime();
}

const STAKES = [10_000, 20_000, 20_000, 50_000, 50_000, 100_000, 100_000, 200_000, 500_000, 1_000_000];

const PAST_MARKETS: readonly { readonly kind: MarketKind; readonly label: string; readonly picks: readonly (readonly [code: string, label: string, chance: number])[] }[] = [
  { kind: "MATCH_RESULT", label: "Match Result", picks: [["HOME", "Home", 0.43], ["DRAW", "Draw", 0.26], ["AWAY", "Away", 0.31]] },
  { kind: "DOUBLE_CHANCE", label: "Double Chance", picks: [["HOME_DRAW", "Home or Draw", 0.69], ["HOME_AWAY", "Home or Away", 0.74], ["DRAW_AWAY", "Draw or Away", 0.57]] },
  { kind: "OVER_UNDER", label: "Total Goals 2.5", picks: [["OVER_2_5", "Over 2.5", 0.48], ["UNDER_2_5", "Under 2.5", 0.52]] },
  { kind: "BOTH_TEAMS_TO_SCORE", label: "Both Teams To Score", picks: [["YES", "Yes", 0.52], ["NO", "No", 0.48]] },
];

const PAST_MARGIN = 0.9;

function pastLeg(random: Rng, key: string, kickoffMs: number): TicketSelection {
  const competition = random.pick(COMPETITIONS);
  const [home, away] = random.shuffle(competition.clubs) as [(typeof competition.clubs)[number], (typeof competition.clubs)[number]];
  const market = random.pick(PAST_MARKETS);
  const [code, pick, chance] = random.pick(market.picks);
  const score = { home: random.poisson(1.45), away: random.poisson(1.15) };
  const matchId = uuidFrom(`shop:past:match:${key}`) as MatchId;
  const marketId = uuidFrom(`shop:past:market:${key}`) as MarketId;

  return {
    matchId,
    marketId,
    selectionId: uuidFrom(`shop:past:selection:${key}`) as SelectionId,
    odds: Math.max(1.05, Math.round((PAST_MARGIN / chance) * (0.94 + random.next() * 0.12) * 100) / 100),
    marketType: market.kind,
    marketLabel: market.label,
    selectionLabel: pick === "Home" ? home.name : pick === "Away" ? away.name : pick,
    matchLabel: `${home.name} v ${away.name}`,
    leagueName: competition.seed.name,
    kickoffAt: new Date(kickoffMs).toISOString(),
    outcome: settleSelection(market.kind, code, score),
    result: formatScore(score.home, score.away),
  };
}

function statusOf(legs: readonly TicketSelection[]): "WON" | "LOST" {
  return legs.every((l) => l.outcome === "WON") ? "WON" : "LOST";
}

const pastCache = new Map<string, readonly Ticket[]>();

export function pastDayTickets(dateKey: string, now: number): readonly Ticket[] {
  const cached = pastCache.get(dateKey);

  if (cached !== undefined) return cached;

  const random = rng(`shop:day:${dateKey}`);
  const dayStart = startOfLocalDay(dateKey);
  const weekend = [0, 6].includes(new Date(dayStart).getDay());
  const count = random.int(34, 52) + (weekend ? 18 : 0);
  const tickets: Ticket[] = [];

  for (let i = 0; i < count; i += 1) {
    const placedAtMs = dayStart + (8 * 60 + random.int(0, 13 * 60)) * 60_000 + random.int(0, 59_000);
    const legCount = random.pick([1, 1, 1, 2, 2, 3, 4]);
    const legs = Array.from({ length: legCount }, (_, l) => pastLeg(random, `${dateKey}:${String(i)}:${String(l)}`, placedAtMs + 180_000));
    const seller = random.pick(COUNTER_STAFF);
    const stake = random.pick(STAKES);
    const totalOdds = combinedOddsOf(legs);
    const potentialPayout = Math.round(stake * totalOdds);
    const result = statusOf(legs);
    const settledAtMs = placedAtMs + 180_000 + (FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds) * 1000;
    const collected = result === "WON" && random.chance(0.9);
    const expired = result === "WON" && !collected && now > placedAtMs + TICKET_EXPIRY_DAYS * DAY_MS;
    const customer = random.chance(0.35) ? random.pick(CUSTOMERS) : undefined;

    tickets.push({
      id: uuidFrom(`shop:ticket:${dateKey}:${String(i)}`) as TicketId,
      code: ticketCode(random),
      shopId: SHOP_ID,
      shopCode: SHOP.code,
      cashierId: seller.id,
      cashierName: seller.displayName,
      ...(customer === undefined ? {} : { customerName: customer[0], customerPhone: customer[1] }),
      selections: legs,
      stake,
      totalOdds,
      potentialPayout,
      status: collected ? "PAID" : expired ? "EXPIRED" : result,
      ...(result === "WON" ? { payout: potentialPayout } : { payout: 0 }),
      placedAt: new Date(placedAtMs).toISOString(),
      settledAt: new Date(settledAtMs).toISOString(),
      ...(collected ? { paidAt: new Date(settledAtMs + random.int(2, 90) * 60_000).toISOString() } : {}),
      expiresAt: expiryFor(placedAtMs),
    });
  }

  tickets.sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  pastCache.set(dateKey, tickets);

  return tickets;
}

export function pastDateKeys(now: number, days: number): readonly string[] {
  return Array.from({ length: days }, (_, i) => toLocalDateKey(new Date(now - (i + 1) * DAY_MS)));
}

function realLeg(fixture: FixtureRef, want: "WON" | "LOST", random: Rng): TicketSelection | undefined {
  const score = scriptFor(fixture).finalScore;
  const markets = marketsFor(fixture, fixture.kickoffMs - 60_000).markets.filter((m) => m.kind !== "CORRECT_SCORE");
  const options = markets.flatMap((market) => market.selections.filter((s) => settleSelection(market.kind, s.code, score) === want && s.odds >= 1.25 && s.odds <= 4.5).map((selection) => ({ market, selection })));

  if (options.length === 0) return undefined;

  const { market, selection } = random.pick(options);

  return {
    matchId: fixture.matchId,
    marketId: market.id,
    selectionId: selection.id,
    odds: selection.odds,
    marketType: market.kind,
    marketLabel: market.name,
    selectionLabel: selection.label,
    matchLabel: `${fixture.home.name} v ${fixture.away.name}`,
    leagueName: fixture.competition.seed.name,
    kickoffAt: new Date(fixture.kickoffMs).toISOString(),
    outcome: want,
    result: formatScore(score.home, score.away),
  };
}

type SeedPlan = { readonly legs: readonly ("WON" | "LOST")[]; readonly stake: number; readonly end: "PAID" | "UNPAID" | "VOID" | "CANCELLED"; readonly customer?: number };

const TODAY_PLAN: readonly SeedPlan[] = [
  { legs: ["WON"], stake: 100_000, end: "PAID", customer: 0 },
  { legs: ["WON", "WON"], stake: 50_000, end: "UNPAID", customer: 2 },
  { legs: ["WON"], stake: 200_000, end: "UNPAID" },
  { legs: ["WON", "LOST"], stake: 20_000, end: "UNPAID", customer: 4 },
  { legs: ["LOST"], stake: 100_000, end: "UNPAID" },
  { legs: ["WON", "WON", "LOST"], stake: 50_000, end: "UNPAID", customer: 6 },
  { legs: ["WON"], stake: 50_000, end: "VOID" },
  { legs: ["WON", "WON"], stake: 20_000, end: "CANCELLED", customer: 8 },
  { legs: ["WON", "WON", "WON"], stake: 10_000, end: "PAID" },
];

export function todaySeedTickets(now: number): readonly Ticket[] {
  const random = rng(`shop:today:${toLocalDateKey(new Date(now))}`);
  const settleLead = (FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds) * 1000;
  const finished = COMPETITIONS.flatMap((competition) => {
    const current = currentRound(competition, now);

    return [current - 1, current - 2, current - 3].flatMap((round) => fixturesForRound(competition, round));
  }).filter((f) => now - f.kickoffMs > settleLead + 5_000);

  if (finished.length < 6) return [];

  const tickets: Ticket[] = [];

  TODAY_PLAN.forEach((plan, index) => {
    const fixtures = random.shuffle(finished).slice(0, plan.legs.length);
    const legs = plan.legs.map((want, l) => realLeg(fixtures[l] as FixtureRef, want, random)).filter((l): l is TicketSelection => l !== undefined);

    if (legs.length !== plan.legs.length) return;

    const firstKickoff = Math.min(...legs.map((l) => Date.parse(l.kickoffAt)));
    const lastKickoff = Math.max(...legs.map((l) => Date.parse(l.kickoffAt)));
    const placedAtMs = firstKickoff - random.int(30, 200) * 1000;
    const settledAtMs = lastKickoff + settleLead;
    const seller = COUNTER_STAFF[index % COUNTER_STAFF.length] as Cashier;
    const totalOdds = combinedOddsOf(legs);
    const potentialPayout = Math.round(plan.stake * totalOdds);
    const result = statusOf(legs);
    const customer = plan.customer === undefined ? undefined : CUSTOMERS[plan.customer];
    const base = {
      id: uuidFrom(`shop:ticket:today:${String(index)}:${String(firstKickoff)}`) as TicketId,
      code: ticketCode(random),
      shopId: SHOP_ID,
      shopCode: SHOP.code,
      cashierId: seller.id,
      cashierName: seller.displayName,
      ...(customer === undefined ? {} : { customerName: customer[0], customerPhone: customer[1] }),
      stake: plan.stake,
      totalOdds,
      potentialPayout,
      placedAt: new Date(placedAtMs).toISOString(),
      expiresAt: expiryFor(placedAtMs),
    };

    if (plan.end === "CANCELLED") {
      tickets.push({ ...base, selections: legs.map((l) => ({ ...l, outcome: "VOID" as const })), status: "CANCELLED", payout: 0, settledAt: new Date(placedAtMs + 40_000).toISOString() });
    } else if (plan.end === "VOID") {
      tickets.push({ ...base, selections: legs.map((l) => ({ ...l, outcome: "VOID" as const, result: "Void" })), status: "VOID", payout: plan.stake, settledAt: new Date(settledAtMs).toISOString() });
    } else {
      const paid = plan.end === "PAID" && result === "WON";

      tickets.push({
        ...base,
        selections: legs,
        status: paid ? "PAID" : result,
        payout: result === "WON" ? potentialPayout : 0,
        settledAt: new Date(settledAtMs).toISOString(),
        ...(paid ? { paidAt: new Date(Math.min(now - 1000, settledAtMs + random.int(30, 240) * 1000)).toISOString() } : {}),
      });
    }
  });

  return tickets;
}

export function combinedOddsOf(legs: readonly { readonly odds: number }[]): number {
  return Math.round(legs.reduce((acc, l) => acc * l.odds, 1) * 100) / 100;
}
