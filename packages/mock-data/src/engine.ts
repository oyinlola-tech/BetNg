import type {
  BetId,
  MatchId,
  SelectionId,
  TransactionId,
  WalletId,
} from "@betng/contracts";
import {
  DataSourceError,
  MAX_SELECTIONS,
  STAKE_LIMITS,
  formatMoney,
  formatScore,
  resolvePhase,
  slipTotals,
  validateSlip,
  type BetLegView,
  type BetPlacementView,
  type BetRejectionReason,
  type BetView,
  type ConnectionState,
  type MatchClockView,
  type MatchEventView,
  type MatchSignal,
  type MatchSummary,
  type MatchView,
  type NotificationPreferences,
  type NotificationView,
  type PageView,
  type PlaceBetInput,
  type TeamView,
  type TransactionQuery,
  type TransactionStatus,
  type TransactionView,
  type WalletView,
} from "@betng/ui-core";
import type { Club } from "./clubs.js";
import { COMPETITIONS } from "./clubs.js";
import {
  marketsFor,
  oddsVersionAt,
  repricedAtMs,
  settleSelection,
} from "./markets.js";
import { rng, uuidFrom } from "./prng.js";
import {
  CYCLE_SECONDS,
  bettingClosesMs,
  bettingOpensMs,
  findFixture,
  fullTimeMs,
  lifecycleAt,
  settledMs,
  statusAt,
  type FixtureRef,
} from "./season.js";
import {
  releasedEvents,
  scoringSide,
  scriptFor,
  statsAt,
  type ScriptEvent,
} from "./simulate.js";
import { VIRTUAL_TIMING, matchClock, minuteStartedAt } from "./timing.js";

export interface KeyValueStorage {
  get(key: string): string | null | undefined;
  set(key: string, value: string): void;
}

export interface MockPlatformOptions {
  readonly now?: () => number;
  readonly storage?: KeyValueStorage;
  /** Simulated network latency for reads, so loading states are exercised. */
  readonly latencyMs?: number;
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
  raised: string[];
  placements: Record<string, BetPlacementView>;
}

export interface StreamHandlers {
  readonly onEvent: (event: MatchEventView) => void;
  readonly onSignal?: ((signal: MatchSignal) => void) | undefined;
}

const STORAGE_KEY = "betng.mock.account.v1";
const WALLET_ID = uuidFrom("wallet:demo") as WalletId;
const CURRENCY = "NGN";
const WITHDRAWAL_PENDING_MS = 5_000;
const REMEMBERED_PLACEMENTS = 200;
const ODDS_TOLERANCE = 0.005;

const LIFECYCLE_SIGNALS: Readonly<Record<string, MatchSignal>> = {
  BETTING_OPEN: "BETTING_OPENED",
  BETTING_CLOSED: "BETTING_CLOSED",
  SIMULATION_STARTED: "SIMULATION_STARTED",
  MATCH_FINISHED: "SETTLEMENT_STARTED",
  SETTLEMENT_COMPLETED: "SETTLEMENT_COMPLETED",
};

const TRANSACTION_SORTS = {
  createdAt: (a: TransactionView, b: TransactionView) =>
    a.createdAt.localeCompare(b.createdAt),
  amount: (a: TransactionView, b: TransactionView) => a.amount - b.amount,
  balanceAfter: (a: TransactionView, b: TransactionView) =>
    a.balanceAfter - b.balanceAfter,
  type: (a: TransactionView, b: TransactionView) =>
    a.type.localeCompare(b.type),
} as const;

/** A bare date as an upper bound covers that whole day. */
function upperBound(to: string): number {
  const parsed = Date.parse(to);

  return /^\d{4}-\d{2}-\d{2}$/.test(to) ? parsed + 86_400_000 - 1 : parsed;
}

function clockView(kickoffAt: string, now: number): MatchClockView {
  const clock = matchClock(kickoffAt, now);

  return {
    period: clock.period,
    minute: clock.minute,
    asOf: new Date(minuteStartedAt(kickoffAt, clock)).toISOString(),
    minuteLengthMs: VIRTUAL_TIMING.secondsPerMinute * 1000,
  };
}

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

function toEventView(
  event: ScriptEvent,
  index: number,
  fixture: FixtureRef,
): MatchEventView {
  return {
    id: event.id,
    matchId: fixture.matchId,
    sequence: index + 1,
    kind: event.kind,
    minute: event.minute,
    ...(event.side === undefined ? {} : { side: event.side }),
    ...(event.player === undefined ? {} : { player: event.player }),
    ...(event.secondaryPlayer === undefined
      ? {}
      : { secondaryPlayer: event.secondaryPlayer }),
    score: event.score,
    description: event.description,
    occurredAt: new Date(
      fixture.kickoffMs + event.releaseSeconds * 1000,
    ).toISOString(),
  };
}

export class MockPlatform {
  readonly now: () => number;

  private readonly storage: KeyValueStorage | undefined;
  private readonly latencyMs: number;
  private account: AccountState;

  private connection: ConnectionState = "CONNECTING";
  private readonly connectionListeners = new Set<
    (s: ConnectionState) => void
  >();
  private readonly accountListeners = new Set<() => void>();
  private outageTimer: ReturnType<typeof setTimeout> | undefined;
  private accountTimer: ReturnType<typeof setInterval> | undefined;
  private readonly jitter = rng("latency");
  private pendingWithdrawals = 0;

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

  public async delay(): Promise<void> {
    const ms = this.latencyMs * (0.6 + this.jitter.next() * 0.8);

    if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));

    if (this.connection === "OFFLINE") {
      throw new DataSourceError("NETWORK", "You appear to be offline.");
    }
  }

  public fixture(matchId: string): FixtureRef | undefined {
    return findFixture(matchId, this.now(), COMPETITIONS);
  }

  /** @endpoint GET /api/v1/matches/:id → Match (joined with fixture, league, teams) */
  public summary(fixture: FixtureRef, now: number = this.now()): MatchSummary {
    const status = statusAt(fixture, now);
    const lifecycle = lifecycleAt(fixture, now);
    const kickoffAt = new Date(fixture.kickoffMs).toISOString();
    const script = scriptFor(fixture);
    const elapsed = (now - fixture.kickoffMs) / 1000;
    const released = releasedEvents(script, elapsed);
    const score =
      status === "COMPLETED"
        ? script.finalScore
        : (released.at(-1)?.score ?? { home: 0, away: 0 });
    const clock =
      status === "IN_PLAY" || status === "COMPLETED"
        ? clockView(kickoffAt, now)
        : undefined;
    const phase = resolvePhase(status, { lifecycle, period: clock?.period });
    const lastEventMs =
      fixture.kickoffMs + (released.at(-1)?.releaseSeconds ?? 0) * 1000;
    const updatedMs =
      status === "SCHEDULED"
        ? Math.min(now, bettingOpensMs(fixture) - CYCLE_SECONDS * 1000)
        : status === "BETTING_OPEN"
          ? Math.max(bettingOpensMs(fixture), repricedAtMs(fixture, now))
          : status === "BETTING_CLOSED"
            ? bettingClosesMs(fixture)
            : status === "IN_PLAY"
              ? Math.max(lastEventMs, Date.parse(clock?.asOf ?? kickoffAt))
              : lifecycle === "SETTLEMENT_COMPLETED"
                ? settledMs(fixture)
                : fullTimeMs(fixture);

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
      bettingClosesAt: new Date(bettingClosesMs(fixture)).toISOString(),
      status,
      phase,
      ...(clock === undefined ? {} : { clock }),
      lifecycle,
      score,
      openMarkets: status === "BETTING_OPEN" ? 8 : 0,
      updatedAt: new Date(updatedMs).toISOString(),
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
    const minute = summary.clock?.minute ?? 0;

    return {
      ...summary,
      events,
      ...(elapsed < 0
        ? {}
        : { stats: statsAt(script, released, minute, fixture.matchId) }),
    };
  }

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

  public simulateOutage(ms = 6000): void {
    if (this.outageTimer !== undefined) clearTimeout(this.outageTimer);

    this.setConnection("RECONNECTING");
    this.outageTimer = setTimeout(() => {
      this.outageTimer = undefined;
      this.setConnection("CONNECTED");
    }, ms);
  }

  public setOnline(online: boolean): void {
    if (online) {
      if (this.connection === "OFFLINE") this.setConnection("RECONNECTING");
      setTimeout(() => {
        if (
          this.connection === "RECONNECTING" &&
          this.outageTimer === undefined
        )
          this.setConnection("CONNECTED");
      }, 800);
    } else {
      this.setConnection("OFFLINE");
    }
  }

  /**
   * Streams a match's events and lifecycle signals as the clock releases them.
   *
   * @endpoint WS /live · SUBSCRIBE match:<id> → EVENT frames (LiveEvent) and lifecycle frames (MatchSignal)
   */
  public stream(fixture: FixtureRef, handlers: StreamHandlers): () => void {
    const script = scriptFor(fixture);
    const started = this.now();
    let delivered = releasedEvents(
      script,
      (started - fixture.kickoffMs) / 1000,
    ).length;
    let lifecycle = lifecycleAt(fixture, started);
    let oddsVersion = oddsVersionAt(fixture, started);

    const timer = setInterval(() => {
      // Nothing flows while the socket is down. The controller re-reads on
      // recovery, which is where the gap is closed.
      if (this.connection !== "CONNECTED") return;

      const now = this.now();
      const nextLifecycle = lifecycleAt(fixture, now);
      const nextVersion = oddsVersionAt(fixture, now);

      if (nextLifecycle !== lifecycle) {
        lifecycle = nextLifecycle;

        const signal = LIFECYCLE_SIGNALS[lifecycle];

        if (signal !== undefined) handlers.onSignal?.(signal);
      }

      if (nextVersion !== oddsVersion) {
        oddsVersion = nextVersion;

        if (lifecycle === "BETTING_OPEN") handlers.onSignal?.("ODDS_UPDATED");
      }

      const released = releasedEvents(script, (now - fixture.kickoffMs) / 1000);

      while (delivered < released.length) {
        const event = released[delivered] as ScriptEvent;

        handlers.onEvent(toEventView(event, delivered, fixture));
        delivered += 1;
      }

      if (lifecycle === "SETTLEMENT_COMPLETED") clearInterval(timer);
    }, 250);

    return () => {
      clearInterval(timer);
    };
  }

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
      placements: {},
      bets: [],
      notifications: [],
      preferences: {
        matchStarting: true,
        matchFinished: true,
        betSettled: true,
        goals: false,
      },
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
      pending: this.pendingTransactions().reduce(
        (total, t) => total + Math.abs(t.amount),
        0,
      ),
      currency: CURRENCY,
      simulated: true,
    };
  }

  private statusOf(transaction: TransactionView): TransactionStatus {
    return transaction.type === "WITHDRAWAL" &&
      this.now() - Date.parse(transaction.createdAt) < WITHDRAWAL_PENDING_MS
      ? "PENDING"
      : "COMPLETED";
  }

  private pendingTransactions(): readonly TransactionView[] {
    return this.account.transactions.filter(
      (t) => this.statusOf(t) === "PENDING",
    );
  }

  /** @endpoint GET /api/v1/wallets/:userId/transactions → { items: Transaction[] } */
  public transactions(): readonly TransactionView[] {
    return this.account.transactions
      .map(
        (t): TransactionView => ({
          ...t,
          status: this.statusOf(t),
          currency: CURRENCY,
          ...(t.type.startsWith("BET_") && t.reference !== undefined
            ? { betId: t.reference }
            : {}),
        }),
      )
      .reverse();
  }

  /** @endpoint GET /api/v1/wallets/:userId/transactions?page=&pageSize=&types=&statuses=&from=&to=&search=&sort=&direction= → Page<Transaction> */
  public queryTransactions(
    query: TransactionQuery,
  ): PageView<TransactionView> {
    const page = Math.max(1, Math.trunc(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 20)));
    const from = query.from === undefined ? undefined : Date.parse(query.from);
    const to = query.to === undefined ? undefined : upperBound(query.to);
    const needle = query.search?.trim().toLowerCase() ?? "";

    const matched = this.transactions().filter((t) => {
      const at = Date.parse(t.createdAt);

      return (
        (query.types === undefined ||
          query.types.length === 0 ||
          query.types.includes(t.type)) &&
        (query.statuses === undefined ||
          query.statuses.length === 0 ||
          (t.status !== undefined && query.statuses.includes(t.status))) &&
        (from === undefined || Number.isNaN(from) || at >= from) &&
        (to === undefined || Number.isNaN(to) || at <= to) &&
        (needle === "" ||
          `${t.description} ${t.reference ?? ""} ${t.id} ${t.type}`
            .toLowerCase()
            .includes(needle))
      );
    });

    const compare =
      TRANSACTION_SORTS[
        (query.sort ?? "createdAt") as keyof typeof TRANSACTION_SORTS
      ] ?? TRANSACTION_SORTS.createdAt;
    const sign = query.direction === "asc" ? 1 : -1;

    matched.sort((a, b) => sign * compare(a, b));

    return {
      items: matched.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: matched.length,
    };
  }

  private ledger(
    type: TransactionView["type"],
    amount: number,
    description: string,
    reference?: string,
  ): void {
    this.account.balance += amount;
    this.account.transactions.push({
      id: uuidFrom(
        `tx:${String(this.account.transactions.length)}:${String(this.now())}`,
      ) as TransactionId,
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
      throw new DataSourceError(
        "INSUFFICIENT_FUNDS",
        "That is more than your available balance.",
      );
    }

    this.ledger("WITHDRAWAL", -amount, "Simulated withdrawal");
    this.persist();

    return this.wallet();
  }

  /**
   * Business refusals are returned as a REJECTED placement; only a malformed request throws.
   *
   * @endpoint POST /api/v1/bets PlaceBetRequest → BetPlacement (the client reference travels in the `idempotency-key` header)
   */
  public placeBet(input: PlaceBetInput): BetPlacementView {
    const clientReference = input.clientReference.trim();

    if (clientReference === "" || clientReference.length > 128) {
      throw new DataSourceError(
        "VALIDATION",
        "A bet needs a client reference so it is never placed twice.",
      );
    }

    const earlier = this.account.placements[clientReference];

    if (earlier !== undefined) return earlier;

    const refuse = (
      reason: BetRejectionReason,
      message: string,
      extra: Pick<BetPlacementView, "maxStake" | "rejectedSelectionIds"> = {},
    ): BetPlacementView => ({
      outcome: "REJECTED",
      clientReference,
      reason,
      message,
      ...extra,
    });

    const { selections, stake } = input;
    const now = this.now();
    const problem = validateSlip(
      selections,
      stake,
      this.account.balance - this.account.reserved,
    );

    if (problem === "EMPTY") return refuse("INVALID_BET", "Add a selection first.");
    if (!Number.isInteger(stake) || problem === "BELOW_MIN") {
      return refuse(
        "INVALID_BET",
        `The minimum stake is ${formatMoney(STAKE_LIMITS.min)}.`,
      );
    }
    if (problem === "ABOVE_MAX") {
      return refuse(
        "STAKE_LIMITED",
        `The maximum stake is ${formatMoney(STAKE_LIMITS.max)}.`,
        { maxStake: STAKE_LIMITS.max },
      );
    }
    if (
      selections.length > MAX_SELECTIONS ||
      new Set(selections.map((s) => s.matchId)).size !== selections.length
    ) {
      return refuse(
        "INVALID_BET",
        `A bet takes up to ${String(MAX_SELECTIONS)} selections, one per match.`,
      );
    }

    const closed: SelectionId[] = [];
    const unknown: SelectionId[] = [];
    const moved: SelectionId[] = [];
    const legs: BetLegView[] = [];

    for (const leg of selections) {
      const fixture = this.fixture(leg.matchId);

      if (fixture === undefined || statusAt(fixture, now) !== "BETTING_OPEN") {
        closed.push(leg.selectionId);
        continue;
      }

      const market = marketsFor(fixture, now).markets.find(
        (m) => m.id === leg.marketId,
      );
      const priced = market?.selections.find((s) => s.id === leg.selectionId);

      if (market === undefined || priced === undefined) {
        unknown.push(leg.selectionId);
        continue;
      }

      if (Math.abs(priced.odds - leg.odds) > ODDS_TOLERANCE) {
        moved.push(leg.selectionId);
        continue;
      }

      // The price and the labels on the bet are the platform's, never the client's.
      legs.push({
        ...leg,
        marketKind: market.kind,
        marketName: market.name,
        selectionLabel: priced.label,
        odds: priced.odds,
        kickoffAt: new Date(fixture.kickoffMs).toISOString(),
        oddsVersion: oddsVersionAt(fixture, now),
        outcome: "PENDING",
      });
    }

    const labelOf = (id: SelectionId): string =>
      selections.find((s) => s.selectionId === id)?.matchLabel ?? "a match";

    if (closed.length > 0) {
      return refuse(
        "MARKET_CLOSED",
        closed.length === 1
          ? `Betting has closed on ${labelOf(closed[0] as SelectionId)}.`
          : `Betting has closed on ${String(closed.length)} of your selections.`,
        { rejectedSelectionIds: closed },
      );
    }
    if (unknown.length > 0) {
      return refuse("INVALID_BET", "A selection on this slip is no longer offered.", {
        rejectedSelectionIds: unknown,
      });
    }
    if (moved.length > 0) {
      return refuse(
        "ODDS_CHANGED",
        moved.length === 1
          ? `The odds changed on ${labelOf(moved[0] as SelectionId)}. Review the new price.`
          : `The odds changed on ${String(moved.length)} of your selections. Review the new prices.`,
        { rejectedSelectionIds: moved },
      );
    }
    if (problem === "INSUFFICIENT") {
      return refuse(
        "INSUFFICIENT_FUNDS",
        "Your simulated balance does not cover that stake.",
      );
    }

    const totals = slipTotals(legs, stake);
    const id = uuidFrom(`bet:${clientReference}`) as BetId;

    const bet: BetView = {
      id,
      legs,
      stake,
      totalOdds: totals.totalOdds,
      potentialPayout: totals.potentialReturn,
      status: "PENDING",
      placedAt: new Date(now).toISOString(),
      currency: CURRENCY,
      reference: clientReference,
    };
    const placement: BetPlacementView = {
      outcome: "ACCEPTED",
      clientReference,
      bet,
    };

    this.ledger(
      "BET_STAKE",
      -stake,
      `Stake · ${legs.map((l) => l.matchLabel).join(", ")}`,
      id,
    );
    this.account.bets.push(bet);
    this.account.placements = Object.fromEntries(
      [
        ...Object.entries(this.account.placements),
        [clientReference, placement] as const,
      ].slice(-REMEMBERED_PLACEMENTS),
    );
    this.persist();

    return placement;
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
    this.account.viewed = [
      matchId,
      ...this.account.viewed.filter((id) => id !== matchId),
    ].slice(0, 30);
    this.storage?.set(STORAGE_KEY, JSON.stringify(this.account));
  }

  private raise(
    key: string,
    notification: Omit<NotificationView, "id" | "createdAt" | "read">,
  ): boolean {
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
      if (!fixtureCache.has(matchId))
        fixtureCache.set(matchId, this.fixture(matchId));

      return fixtureCache.get(matchId);
    };

    const betMatches = new Set<string>(
      this.account.bets
        .filter((b) => b.status === "PENDING")
        .flatMap((b) => b.legs.map((l) => l.matchId)),
    );
    const watched = new Set<string>(this.account.viewed.slice(0, 5));

    for (const matchId of new Set<string>([...betMatches, ...watched])) {
      const fixture = fixtureOf(matchId);

      if (fixture === undefined) continue;

      const status = statusAt(fixture, now);
      const s = this.summary(fixture, now);
      const label = `${s.home.name} v ${s.away.name}`;

      if (status === "BETTING_CLOSED" && prefs.matchStarting) {
        changed =
          this.raise(`starting:${matchId}`, {
            kind: "MATCH_STARTING",
            title: "Kicking off shortly",
            body: `${label} · ${s.leagueCode} ${String(s.matchday).padStart(2, "0")}`,
            matchId: matchId as MatchId,
          }) || changed;
      }

      if (status === "COMPLETED" && prefs.matchFinished) {
        changed =
          this.raise(`finished:${matchId}`, {
            kind: betMatches.has(matchId)
              ? "RESULT_AVAILABLE"
              : "MATCH_FINISHED",
            title: "Full time",
            body: `${s.home.name} ${formatScore(s.score.home, s.score.away)} ${s.away.name}`,
            matchId: matchId as MatchId,
          }) || changed;
      }

      if (status === "IN_PLAY" && prefs.goals && watched.has(matchId)) {
        const goals = this.view(fixture, now).events.filter(
          (e) => scoringSide(e) !== undefined,
        );

        for (const goal of goals) {
          changed =
            this.raise(`goal:${goal.id}`, {
              kind: "MATCH_EVENT",
              title: `Goal · ${scoringSide(goal) === "HOME" ? s.home.name : s.away.name}`,
              body: `${goal.player ?? ""} · ${formatScore(goal.score.home, goal.score.away)} · ${String(goal.minute)}'`,
              matchId: matchId as MatchId,
            }) || changed;
        }
      }
    }

    for (const bet of this.account.bets) {
      if (bet.status !== "PENDING") continue;

      const legs = bet.legs.map((leg) => {
        const fixture = fixtureOf(leg.matchId);

        if (fixture === undefined) return { ...leg, outcome: "VOID" as const };

        if (now < settledMs(fixture)) return leg;

        const score = scriptFor(fixture).finalScore;

        return {
          ...leg,
          outcome: settleSelection(
            leg.marketKind,
            leg.selectionId === "" ? "" : this.codeFor(leg),
            score,
          ),
          result: formatScore(score.home, score.away),
        };
      });

      if (legs.some((l) => l.outcome === "PENDING")) continue;

      const voided = legs.every((l) => l.outcome === "VOID");
      const won =
        !voided &&
        legs.every((l) => l.outcome === "WON" || l.outcome === "VOID");
      const payout = voided ? bet.stake : won ? bet.potentialPayout : 0;
      const settled: BetView = {
        ...bet,
        legs,
        status: voided ? "VOID" : won ? "WON" : "LOST",
        settledAt: new Date(now).toISOString(),
        payout,
      };

      this.account.bets = this.account.bets.map((b) =>
        b.id === bet.id ? settled : b,
      );

      if (payout > 0) {
        this.ledger(
          voided ? "BET_REFUND" : "BET_PAYOUT",
          payout,
          `${voided ? "Refund" : "Payout"} · ${legs.map((l) => l.matchLabel).join(", ")}`,
          bet.id,
        );
      }

      if (prefs.betSettled) {
        this.raise(`settled:${bet.id}`, {
          kind: "BET_SETTLED",
          title: won
            ? `Bet won · ${formatMoney(payout)}`
            : voided
              ? "Bet voided"
              : "Bet lost",
          body: legs
            .map((l) => `${l.selectionLabel} · ${l.matchLabel}`)
            .join(" · "),
          betId: bet.id,
        });
      }

      changed = true;
    }

    const pending = this.pendingTransactions().length;

    if (pending < this.pendingWithdrawals) changed = true;

    this.pendingWithdrawals = pending;

    if (changed) this.persist();
  }

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
