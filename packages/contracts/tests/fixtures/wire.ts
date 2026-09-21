/** Payloads as the services are expected to send them. A schema change that breaks one of these breaks a client. */

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const IDS = {
  league: id(1),
  home: id(2),
  away: id(3),
  fixture: id(4),
  match: id(5),
  market: id(6),
  selectionHome: id(7),
  selectionDraw: id(8),
  selectionAway: id(9),
  bet: id(10),
  user: id(11),
  wallet: id(12),
  transaction: id(13),
  settlement: id(14),
};

const T = "2026-09-21T12:00:00.000Z";

export const matchResponse = {
  id: IDS.match,
  fixtureId: IDS.fixture,
  status: "IN_PLAY",
  score: { home: 1, away: 0 },
  lifecycle: "EVENTS_PUBLISHED",
  createdAt: T,
  updatedAt: T,
};

export const fixtureResponse = {
  id: IDS.fixture,
  leagueId: IDS.league,
  season: 1,
  matchday: 4,
  homeTeamId: IDS.home,
  awayTeamId: IDS.away,
  kickoffAt: T,
  bettingClosesAt: "2026-09-21T11:59:50.000Z",
  createdAt: T,
};

export const oddsResponse = {
  matchId: IDS.match,
  generatedAt: T,
  markets: [
    {
      id: IDS.market,
      matchId: IDS.match,
      type: "MATCH_RESULT",
      status: "OPEN",
      oddsVersion: 3,
      updatedAt: T,
      selections: [
        { id: IDS.selectionHome, marketId: IDS.market, code: "HOME", label: "Home", odds: 2.15, probability: 0.44 },
        { id: IDS.selectionDraw, marketId: IDS.market, code: "DRAW", label: "Draw", odds: 3.2, probability: 0.29 },
        { id: IDS.selectionAway, marketId: IDS.market, code: "AWAY", label: "Away", odds: 2.8, probability: 0.27 },
      ],
    },
  ],
};

export const betRequest = {
  userId: IDS.user,
  stake: 50_000,
  currency: "NGN",
  selections: [
    {
      matchId: IDS.match,
      marketId: IDS.market,
      selectionId: IDS.selectionHome,
      odds: 2.15,
      oddsVersion: 3,
      marketType: "MATCH_RESULT",
      marketLabel: "Match Result",
      selectionLabel: "Home",
    },
  ],
};

export const betResponse = {
  id: IDS.bet,
  userId: IDS.user,
  selections: betRequest.selections,
  stake: 50_000,
  currency: "NGN",
  totalOdds: 2.15,
  potentialPayout: 107_500,
  status: "PENDING",
  placedAt: T,
  channel: "ONLINE",
};

export const walletResponse = {
  id: IDS.wallet,
  userId: IDS.user,
  balance: 1_000_000,
  reserved: 50_000,
  currency: "NGN",
  createdAt: T,
  updatedAt: T,
};

export const transactionResponse = {
  id: IDS.transaction,
  walletId: IDS.wallet,
  type: "BET_STAKE",
  amount: -50_000,
  currency: "NGN",
  balanceAfter: 950_000,
  reference: IDS.bet,
  createdAt: T,
};

export const settlementResponse = {
  id: IDS.settlement,
  betId: IDS.bet,
  outcome: "WON",
  selections: [{ selectionId: IDS.selectionHome, matchId: IDS.match, outcome: "WON" }],
  payout: 107_500,
  currency: "NGN",
  settledAt: T,
};

export const liveFrames = [
  { matchId: IDS.match, sequence: 1, type: "BETTING_CLOSED", minute: 0, score: { home: 0, away: 0 }, description: "Betting closed", occurredAt: T },
  { matchId: IDS.match, sequence: 2, type: "KICKOFF", minute: 0, score: { home: 0, away: 0 }, description: "Kick-off", occurredAt: T },
  { matchId: IDS.match, sequence: 3, type: "GOAL", minute: 12, side: "HOME", score: { home: 1, away: 0 }, description: "Goal", occurredAt: T },
  { matchId: IDS.match, sequence: 4, type: "HALF_TIME", minute: 45, score: { home: 1, away: 0 }, description: "Half time", occurredAt: T },
  { matchId: IDS.match, sequence: 5, type: "MATCH_FINISHED", minute: 90, score: { home: 1, away: 0 }, description: "Full time", occurredAt: T },
  { matchId: IDS.match, sequence: 6, type: "SETTLEMENT_COMPLETED", minute: 90, score: { home: 1, away: 0 }, description: "Settled", occurredAt: T },
];

export const errorResponse = {
  error: {
    code: "STAKE_LIMITED",
    message: "The stake is above the limit for this selection.",
    requestId: "req-1",
    data: { maxStake: 20_000 },
  },
};

export const clockResponse = { period: "SECOND_HALF", minute: 67, asOf: T, minuteLengthMs: 2000 };

export const lineupsResponse = {
  matchId: IDS.match,
  confirmed: true,
  home: {
    teamId: IDS.home,
    side: "HOME",
    formation: "4-3-3",
    manager: "A. Manager",
    starting: [{ id: "p1", name: "Keeper One", shirt: 1, position: "GK", grid: { row: 1, slot: 1 } }],
    substitutes: [{ id: "p12", name: "Sub Twelve", shirt: 12 }],
  },
};

export const headToHeadResponse = {
  matchId: IDS.match,
  played: 1,
  homeWins: 1,
  draws: 0,
  awayWins: 0,
  meetings: [{ matchId: IDS.match, leagueId: IDS.league, homeTeamId: IDS.home, awayTeamId: IDS.away, kickoffAt: T, score: { home: 2, away: 1 } }],
};

export const searchResponse = {
  term: "ash",
  hits: [{ kind: "TEAM", id: IDS.home, title: "Ashford City", subtitle: "Premier League", teamId: IDS.home, leagueId: IDS.league }],
};

export const configResponse = {
  currency: { code: "NGN", symbol: "₦", minorUnits: 2, locale: "en-NG" },
  features: { walletEnabled: true, liveEnabled: true },
  stakeLimits: { min: 5_000, max: 50_000_000, maxSelections: 20 },
  competitionTimezone: "Africa/Lagos",
};
