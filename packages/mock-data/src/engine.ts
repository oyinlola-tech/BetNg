/**
 * The in-process platform.
 *
 * Holds what the real services hold — the clock-driven state of every
 * match, one user's simulated wallet, bets and notifications — and does
 * what they do: releases live events against the clock, settles bets when
 * matches finish, and raises notifications. Every public method notes the
 * gateway endpoint it stands in for, so the backend can be implemented
 * against this file.
 */

import type { BetId, MatchId, TransactionId, WalletId } from "@betng/contracts";
import {
  DataSourceError,
  FULL_TIME_SECONDS,
  VIRTUAL_TIMING,
  derivePhase,
  formatMoney,
  formatScore,
  matchClock,
  slipTotals,
  validateSlip,
  type BetView,
  type ConnectionState,
  type MatchEventView,
  type MatchSummary,
  type MatchView,
  type NotificationPreferences,
  type NotificationView,
  type PlaceBetInput,
  type TeamView,
  type TransactionView,
  type WalletView,
} from "@betng/ui-core";
import type { Club } from "./clubs.js";
import { COMPETITIONS } from "./clubs.js";
import { marketsFor, settleSelection } from "./markets.js";
import { uuidFrom } from "./prng.js";
import { findFixture, statusAt, type FixtureRef } from "./season.js";
import { releasedEvents, scriptFor, statsAt, type ScriptEvent } from "./simulate.js";

export interface KeyValueStorage {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
}

export interface MockPlatformOptions {
  /** The clock. Injected by tests; real time otherwise. */
  readonly now?: () => number;
  /** Persists the account between sessions. */
  readonly storage?: KeyValueStorage;
  /** Simulated network latency for reads, so loading states are exercised. */
  readonly latencyMs?: number;
  /** Opening balance in kobo. */
  readonly openingBalance?: number;
}

interface AccountState {
  balance: number;
  reserved: number;
  transactions: TransactionView[];
  bets: BetView[];
  notifications: NotificationView[];
  preferences: NotificationPreferences;
  viewed: string[];
  /** Notification keys already raised, so a reload does not repeat them. */
  raised: string[];
}

const STORAGE_KEY = "betng.mock.account.v1";
const WALLET_ID = uuidFrom("wallet:demo") as WalletId;

export function teamView(club: Club): TeamView {
  return {
    id: club.id,
    leagueId: club.leagueId,
    name: club.name,
    shortName: club.shortName,
    code: club.code,
    city: club.city,
    stadium: club.stadium,
    colors: club.colors,
    strength: club.strength,
  };
}

function toEventView(event: ScriptEvent, index: number, fixture: FixtureRef): MatchEventView {
  return {
    id: event.id,
    matchId: fixture.matchId,
    sequence: index + 1,
    kind: event.kind,
    minute: event.minute,
    ...(event.side === undefined ? {} : { side: event.side }),
    ...(event.player === undefined ? {} : { player: event.player }),
    ...(event.secondaryPlayer === undefined ? {} : { secondaryPlayer: event.secondaryPlayer }),
    score: event.score,
    description: event.description,
    occurredAt: new Date(fixture.kickoffMs + event.releaseSeconds * 1000).toISOString(),
  };
}

export class MockPlatform {
  readonly now: () => number;

  private readonly storage: KeyValueStorage | undefined;
  private readonly latencyMs: number;
  private account: AccountState;

  private connection: ConnectionState = "CONNECTING";
  private readonly connectionListeners = new Set<(s: ConnectionState) => void>();
  private readonly accountListeners = new Set<() => void>();
  private outageTimer: ReturnType<typeof setTimeout> | undefined;
  private accountTimer: ReturnType<typeof setInterval> | undefined;

  public constructor(options: MockPlatformOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.storage = options.storage;
    this.latencyMs = options.latencyMs ?? 140;
    this.account = this.loadAccount(options.openingBalance ?? 2_500_000);

    // The socket "connects" shortly after the app starts.
    setTimeout(() => {
      if (this.connection === "CONNECTING") this.setConnection("CONNECTED");
    }, 350);

    this.accountTimer = setInterval(() => {
      this.settleAndNotify();
    }, 1000);
  }

  public dispose(): void {
    if (this.accountTimer !== undefined) clearInterval(this.accountTimer);
    if (this.outageTimer !== undefined) clearTimeout(this.outageTimer);
  }

  /* ---- Latency ------------------------------------------------------- */

  /** Resolves after a short, slightly variable delay. */
  public async delay(): Promise<void> {
    const ms = this.latencyMs * (0.6 + Math.random() * 0.8);

    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));

    if (this.connection === "OFFLINE") {
      throw new DataSourceError("NETWORK", "You appear to be offline.");
    }
  }

  /* ---- Matches ------------------------------------------------------- */

  public fixture(matchId: string): FixtureRef | undefined {
    return findFixture(matchId, this.now(), COMPETITIONS);
  }

  /** @endpoint GET /api/v1/matches/:id → Match (joined with fixture, league, teams) */
  public summary(fixture: FixtureRef, now: number = this.now()): MatchSummary {
    const status = statusAt(fixture, now);
    const kickoffAt = new Date(fixture.kickoffMs).toISOString();
    const script = scriptFor(fixture);
    const elapsed = (now - fixture.kickoffMs) / 1000;
    const released = releasedEvents(script, elapsed);
    const score = status === "COMPLETED" ? script.finalScore : (released.at(-1)?.score ?? { home: 0, away: 0 });
    const phase = derivePhase(status, kickoffAt, now);

    return {
      id: fixture.matchId,
      fixtureId: fixture.fixtureId,
      leagueId: fixture.competition.id,
      leagueName: fixture.competition.seed.name,
      leagueCode: fixture.competition.seed.code,
      season: fixture.season,
      matchday: fixture.matchday,
      home: teamView(fixture.home),
      away: teamView(fixture.away),
      kickoffAt,
      bettingClosesAt: new Date(fixture.kickoffMs - VIRTUAL_TIMING.bettingCloseLeadSeconds * 1000).toISOString(),
      status,
      phase,
      score,
      openMarkets: status === "BETTING_OPEN" ? 8 : 0,
    };
  }

  /**
   * @endpoint GET /api/v1/matches/:id/events → { items: MatchEvent[] }
   * @endpoint GET /api/v1/matches/:id/stats → MatchStats
   */
  public view(fixture: FixtureRef, now: number = this.now()): MatchView {
    const summary = this.summary(fixture, now);
    const script = scriptFor(fixture);
    const elapsed = (now - fixture.kickoffMs) / 1000;
    const released = releasedEvents(script, elapsed);
    const events = released.map((e, i) => toEventView(e, i, fixture));
    const clock = matchClock(summary.kickoffAt, now);
    const minute = summary.status === "COMPLETED" ? 90 : clock.minute;

    return {
      ...summary,
      events,
      ...(elapsed < 0 ? {} : { stats: statsAt(script, released, minute, fixture.matchId) }),
    };
  }

  /* ---- Live ---------------------------------------------------------- */

  public getConnection(): ConnectionState {
    return this.connection;
  }

  public onConnection(listener: (s: ConnectionState) => void): () => void {
    this.connectionListeners.add(listener);

    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private setConnection(state: ConnectionState): void {
    if (this.connection === state) return;

    this.connection = state;

    for (const l of this.connectionListeners) l(state);
  }

  /** Drops the connection for a while, then recovers. For demonstrating the reconnect path. */
  public simulateOutage(ms = 6000): void {
    if (this.outageTimer !== undefined) clearTimeout(this.outageTimer);

    this.setConnection("RECONNECTING");
    this.outageTimer = setTimeout(() => {
      this.outageTimer = undefined;
      this.setConnection("CONNECTED");
    }, ms);
  }

  /** Mirrors the device's own online/offline state. */
  public setOnline(online: boolean): void {
    if (online) {
      if (this.connection === "OFFLINE") this.setConnection("RECONNECTING");
      setTimeout(() => {
        if (this.connection === "RECONNECTING" && this.outageTimer === undefined) this.setConnection("CONNECTED");
      }, 800);
    } else {
      this.setConnection("OFFLINE");
    }
  }

  /**
   * Streams a match's events as the clock releases them.
   *
   * @endpoint WS /live · SUBSCRIBE match:<id> → EVENT frames (LiveEvent)
   */
  public stream(fixture: FixtureRef, onEvent: (event: MatchEventView) => void): () => void {
    const script = scriptFor(fixture);
    let delivered = releasedEvents(script, (this.now() - fixture.kickoffMs) / 1000).length;

    const timer = setInterval(() => {
      // Nothing flows while the socket is down. The controller re-reads on
      // recovery, which is where the gap is closed.
      if (this.connection !== "CONNECTED") return;

      const released = releasedEvents(script, (this.now() - fixture.kickoffMs) / 1000);

      while (delivered < released.length) {
        const event = released[delivered] as ScriptEvent;

        onEvent(toEventView(event, delivered, fixture));
        delivered += 1;
      }

      if (delivered >= script.events.length) clearInterval(timer);
    }, 250);

    return () => {
      clearInterval(timer);
    };
  }

  /* ---- Account ------------------------------------------------------- */

  private loadAccount(openingBalance: number): AccountState {
    const fresh: AccountState = {
      balance: openingBalance,
      reserved: 0,
      transactions: [
        {
          id: uuidFrom("tx:opening") as TransactionId,
          type: "DEPOSIT",
          amount: openingBalance,
          balanceAfter: openingBalance,
          description: "Opening simulated balance",
          createdAt: new Date(this.now() - 86_400_000).toISOString(),
        },
      ],
      bets: [],
      notifications: [],
      preferences: { matchStarting: true, matchFinished: true, betSettled: true, goals: false },
      viewed: [],
      raised: [],
    };

    try {
      const raw = this.storage?.get(STORAGE_KEY);

      if (raw === null || raw === undefined) return fresh;

      return { ...fresh, ...(JSON.parse(raw) as Partial<AccountState>) };
    } catch {
      return fresh;
    }
  }

  private persist(): void {
    this.storage?.set(STORAGE_KEY, JSON.stringify(this.account));

    for (const l of this.accountListeners) l();
  }

  public onAccount(listener: () => void): () => void {
    this.accountListeners.add(listener);

    return () => {
      this.accountListeners.delete(listener);
    };
  }

  /** @endpoint GET /api/v1/wallets/:userId → Wallet */
  public wallet(): WalletView {
    return {
      id: WALLET_ID,
      balance: this.account.balance,
      reserved: this.account.reserved,
      available: this.account.balance - this.account.reserved,
      currency: "NGN",
      simulated: true,
    };
  }

  /** @endpoint GET /api/v1/wallets/:userId/transactions → { items: Transaction[] } */
  public transactions(): readonly TransactionView[] {
    return [...this.account.transactions].reverse();
  }

  private ledger(type: TransactionView["type"], amount: number, description: string, reference?: string): void {
    this.account.balance += amount;
    this.account.transactions.push({
      id: uuidFrom(`tx:${String(this.account.transactions.length)}:${String(this.now())}`) as TransactionId,
      type,
      amount,
      balanceAfter: this.account.balance,
      description,
      ...(reference === undefined ? {} : { reference }),
      createdAt: new Date(this.now()).toISOString(),
    });
  }

  /** @endpoint POST /api/v1/wallets/deposit { userId, amount } → { wallet, transaction } */
  public deposit(amount: number): WalletView {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DataSourceError("VALIDATION", "Enter an amount to deposit.");
    }

    this.ledger("DEPOSIT", amount, "Simulated deposit");
    this.persist();

    return this.wallet();
  }

  /** @endpoint POST /api/v1/wallets/withdraw { userId, amount } → { wallet, transaction } */
  public withdraw(amount: number): WalletView {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DataSourceError("VALIDATION", "Enter an amount to withdraw.");
    }
    if (amount > this.account.balance - this.account.reserved) {
      throw new DataSourceError("INSUFFICIENT_FUNDS", "That is more than your available balance.");
    }

    this.ledger("WITHDRAWAL", -amount, "Simulated withdrawal");
    this.persist();

    return this.wallet();
  }

  /** @endpoint POST /api/v1/bets PlaceBetRequest → Bet */
  public placeBet(input: PlaceBetInput): BetView {
    const problem = validateSlip(input.selections, input.stake, this.account.balance - this.account.reserved);

    if (problem === "EMPTY") throw new DataSourceError("VALIDATION", "Add a selection first.");
    if (problem === "BELOW_MIN") throw new DataSourceError("VALIDATION", "The minimum stake is ₦50.");
    if (problem === "ABOVE_MAX") throw new DataSourceError("VALIDATION", "The maximum stake is ₦500,000.");
    if (problem === "INSUFFICIENT") {
      throw new DataSourceError("INSUFFICIENT_FUNDS", "Your simulated balance does not cover that stake.");
    }

    for (const leg of input.selections) {
      const fixture = this.fixture(leg.matchId);

      if (fixture === undefined || statusAt(fixture, this.now()) !== "BETTING_OPEN") {
        throw new DataSourceError("BETTING_CLOSED", `Betting has closed on ${leg.matchLabel}.`);
      }
    }

    const totals = slipTotals(input.selections, input.stake);
    const id = uuidFrom(`bet:${String(this.account.bets.length)}:${String(this.now())}`) as BetId;

    const bet: BetView = {
      id,
      legs: input.selections.map((s) => ({ ...s, outcome: "PENDING" })),
      stake: input.stake,
      totalOdds: totals.totalOdds,
      potentialPayout: totals.potentialReturn,
      status: "PENDING",
      placedAt: new Date(this.now()).toISOString(),
    };

    this.ledger("BET_STAKE", -input.stake, `Stake · ${bet.legs.map((l) => l.matchLabel).join(", ")}`, id);
    this.account.bets.push(bet);
    this.persist();

    return bet;
  }

  /** @endpoint GET /api/v1/bets?userId= → { items: Bet[] } */
  public bets(): readonly BetView[] {
    return [...this.account.bets].reverse();
  }

  /** @endpoint GET /api/v1/bets/:id → Bet */
  public bet(betId: string): BetView | undefined {
    return this.account.bets.find((b) => b.id === betId);
  }

  /** @endpoint GET /api/v1/users/:id/notifications → { items: Notification[] } */
  public notifications(): readonly NotificationView[] {
    return [...this.account.notifications].reverse();
  }

  /** @endpoint POST /api/v1/users/:id/notifications/read { ids? } */
  public markRead(ids?: readonly string[]): void {
    this.account.notifications = this.account.notifications.map((n) =>
      ids === undefined || ids.includes(n.id) ? { ...n, read: true } : n,
    );
    this.persist();
  }

  public preferences(): NotificationPreferences {
    return this.account.preferences;
  }

  public setPreferences(preferences: NotificationPreferences): void {
    this.account.preferences = preferences;
    this.persist();
  }

  public viewed(): readonly string[] {
    return this.account.viewed;
  }

  public recordView(matchId: string): void {
    this.account.viewed = [matchId, ...this.account.viewed.filter((id) => id !== matchId)].slice(0, 30);
    this.storage?.set(STORAGE_KEY, JSON.stringify(this.account));
  }

  private raise(key: string, notification: Omit<NotificationView, "id" | "createdAt" | "read">): boolean {
    if (this.account.raised.includes(key)) return false;

    this.account.raised = [...this.account.raised.slice(-300), key];
    this.account.notifications.push({
      ...notification,
      id: uuidFrom(`notification:${key}`),
      createdAt: new Date(this.now()).toISOString(),
      read: false,
    });

    return true;
  }

  /**
   * The settlement service and the notifier, in one tick.
   *
   * @endpoint (internal) settlement reacts to COMPLETED matches; the client only reads the outcome.
   */
  private settleAndNotify(): void {
    const now = this.now();
    let changed = false;
    const prefs = this.account.preferences;

    const fixtureCache = new Map<string, FixtureRef | undefined>();
    const fixtureOf = (matchId: string): FixtureRef | undefined => {
      if (!fixtureCache.has(matchId)) fixtureCache.set(matchId, this.fixture(matchId));

      return fixtureCache.get(matchId);
    };

    /* Matches the user cares about: those with a pending bet, and those recently watched. */
    const betMatches = new Set<string>(
      this.account.bets.filter((b) => b.status === "PENDING").flatMap((b) => b.legs.map((l) => l.matchId)),
    );
    const watched = new Set<string>(this.account.viewed.slice(0, 5));

    for (const matchId of new Set<string>([...betMatches, ...watched])) {
      const fixture = fixtureOf(matchId);

      if (fixture === undefined) continue;

      const status = statusAt(fixture, now);
      const s = this.summary(fixture, now);
      const label = `${s.home.name} v ${s.away.name}`;

      if (status === "BETTING_CLOSED" && prefs.matchStarting) {
        changed = this.raise(`starting:${matchId}`, {
          kind: "MATCH_STARTING",
          title: "Kicking off shortly",
          body: `${label} · ${s.leagueCode} ${String(s.matchday).padStart(2, "0")}`,
          matchId: matchId as MatchId,
        }) || changed;
      }

      if (status === "COMPLETED" && prefs.matchFinished) {
        changed = this.raise(`finished:${matchId}`, {
          kind: betMatches.has(matchId) ? "RESULT_AVAILABLE" : "MATCH_FINISHED",
          title: "Full time",
          body: `${s.home.name} ${formatScore(s.score.home, s.score.away)} ${s.away.name}`,
          matchId: matchId as MatchId,
        }) || changed;
      }

      if (status === "IN_PLAY" && prefs.goals && watched.has(matchId)) {
        const goals = this.view(fixture, now).events.filter((e) => e.kind === "GOAL");

        for (const goal of goals) {
          changed = this.raise(`goal:${goal.id}`, {
            kind: "MATCH_EVENT",
            title: `Goal · ${goal.side === "HOME" ? s.home.name : s.away.name}`,
            body: `${goal.player ?? ""} · ${formatScore(goal.score.home, goal.score.away)} · ${String(goal.minute)}'`,
            matchId: matchId as MatchId,
          }) || changed;
        }
      }
    }

    /* Settlement. */
    for (const bet of this.account.bets) {
      if (bet.status !== "PENDING") continue;

      const legs = bet.legs.map((leg) => {
        const fixture = fixtureOf(leg.matchId);

        if (fixture === undefined) return { ...leg, outcome: "VOID" as const };

        const seconds = (now - fixture.kickoffMs) / 1000;

        if (seconds < FULL_TIME_SECONDS + VIRTUAL_TIMING.settlementDelaySeconds) return leg;

        const score = scriptFor(fixture).finalScore;

        return {
          ...leg,
          outcome: settleSelection(leg.marketKind, leg.selectionId === "" ? "" : this.codeFor(leg), score),
          result: formatScore(score.home, score.away),
        };
      });

      if (legs.some((l) => l.outcome === "PENDING")) continue;

      const voided = legs.every((l) => l.outcome === "VOID");
      const won = !voided && legs.every((l) => l.outcome === "WON" || l.outcome === "VOID");
      const payout = voided ? bet.stake : won ? bet.potentialPayout : 0;
      const settled: BetView = {
        ...bet,
        legs,
        status: voided ? "VOID" : won ? "WON" : "LOST",
        settledAt: new Date(now).toISOString(),
        payout,
      };

      this.account.bets = this.account.bets.map((b) => (b.id === bet.id ? settled : b));

      if (payout > 0) {
        this.ledger(voided ? "BET_REFUND" : "BET_PAYOUT", payout, `${voided ? "Refund" : "Payout"} · ${legs.map((l) => l.matchLabel).join(", ")}`, bet.id);
      }

      if (prefs.betSettled) {
        this.raise(`settled:${bet.id}`, {
          kind: "BET_SETTLED",
          title: won ? `Bet won · ${formatMoney(payout)}` : voided ? "Bet voided" : "Bet lost",
          body: legs.map((l) => `${l.selectionLabel} · ${l.matchLabel}`).join(" · "),
          betId: bet.id,
        });
      }

      changed = true;
    }

    if (changed) this.persist();
  }

  /** The market code a slip selection was made on, recovered from its id. */
  private codeFor(leg: BetView["legs"][number]): string {
    const fixture = this.fixture(leg.matchId);

    if (fixture === undefined) return "";

    // Selection ids are derived from market id + code, so the code is found
    // by re-deriving. The real betting service stores it on the leg.
    const found = marketsFor(fixture, fixture.kickoffMs)
      .markets.flatMap((m) => m.selections)
      .find((s) => s.id === leg.selectionId);

    return found?.code ?? "";
  }
}
