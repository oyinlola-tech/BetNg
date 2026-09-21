import { CommandHandler } from "@zudojs/cqrs";
import { asId, CURRENCY } from "@betng/contracts";
import type { RiskDecision, RiskReason } from "@betng/contracts";
import type { Logger } from "@betng/service-kit";
import {
  AUDIT_ACTION,
  BETTING_COMMAND,
  MAX_LEGS,
  OPEN_LIFECYCLES,
  OPEN_MARKET_STATUS,
  TICKET,
} from "../../../../constants/index.js";
import {
  actorNotAllowed,
  insufficientFunds,
  invalidBet,
  marketClosed,
  oddsChanged,
  PeerRefusedError,
  placementUnavailable,
  riskRejected,
  riskUnavailable,
  stakeLimited,
  stakeNotTaken,
  upstreamUnavailable,
} from "../../../../errors/index.js";
import type {
  BetRecord,
  BetRepository,
  CounterStaff,
  IdentityPeer,
  LegSnapshot,
  MarketReader,
  MatchLock,
  NewBet,
  NewBetLeg,
  NewTicket,
  RiskPeer,
  TicketRecord,
  WalletMovement,
  WalletPeer,
} from "../../../../interfaces/index.js";
import {
  generateTicketCode,
  marketLabel,
  parseHundredths,
  parseTenths,
  priceSlip,
  submittedHundredths,
} from "../../../../utils/index.js";
import type { PlaceBetCommand, SubmittedLeg } from "./placeBet.command.js";

export interface PlacementResult {
  readonly bet: BetRecord;
  readonly ticket: TicketRecord | undefined;
  readonly replayed: boolean;
}

export interface PlaceBetDependencies {
  readonly bets: BetRepository;
  readonly markets: MarketReader;
  readonly lock: MatchLock;
  readonly risk: RiskPeer;
  readonly wallet: WalletPeer;
  readonly identity: IdentityPeer;
  readonly logger: Logger;
  readonly now: () => Date;
}

const RISK_REJECTION_MESSAGE: Readonly<Record<RiskReason, string>> =
  Object.freeze({
    WITHIN_LIMIT: "This bet cannot be accepted right now.",
    STAKE_LIMIT: "The stake is above the limit for a single bet.",
    PAYOUT_LIMIT: "The potential payout is above the limit for a single bet.",
    EXPOSURE_LIMIT: "This selection is not taking more bets right now.",
    MARKET_CLOSED: "Betting has closed on one of these markets.",
    MARKET_SUSPENDED: "One of these markets is suspended.",
    STAKE_BELOW_MINIMUM: "The stake is below the minimum.",
    INVALID_SELECTION: "One of these selections cannot be bet on.",
  });

const DAY_MS = 24 * 60 * 60 * 1000;

interface StakePlan {
  readonly take: "debit" | "credit";
  readonly movement: WalletMovement;
  readonly undo: WalletMovement;
}

// Order is the integrity rule: lock → price from the database → risk (fail closed) → stake → insert (stake returned on failure).
// The client's odds are only compared; stored odds, versions and payout are the server's.
export class PlaceBetHandler extends CommandHandler<
  PlaceBetCommand,
  PlacementResult
> {
  public readonly commandType = BETTING_COMMAND.PLACE_BET;

  private readonly deps: PlaceBetDependencies;

  public constructor(dependencies: PlaceBetDependencies) {
    super();
    this.deps = dependencies;
  }

  public async execute(command: PlaceBetCommand): Promise<PlacementResult> {
    assertSlipShape(command.legs);

    const key = scopedKey(command);
    const earlier = await this.deps.bets.findByIdempotencyKey(key);

    if (earlier !== undefined) {
      return { ...earlier, replayed: true };
    }

    const staff =
      command.channel === "SHOP" ? await this.counterStaff(command) : undefined;

    const held = await this.deps.lock.withMatches(
      command.legs.map((leg) => leg.matchId),
      async () => this.placeLocked(command, key, staff),
    );

    if (!held.acquired) {
      throw placementUnavailable();
    }

    return held.value;
  }

  private async counterStaff(command: PlaceBetCommand): Promise<CounterStaff> {
    const { actor } = command;

    if (actor.shopId === undefined) {
      throw actorNotAllowed("This cashier is not attached to a shop.");
    }

    const staff = await this.deps.markets.loadCounterStaff(
      actor.id,
      actor.shopId,
    );

    if (
      staff === undefined ||
      staff.shopStatus !== "ACTIVE" ||
      staff.cashierStatus !== "ACTIVE"
    ) {
      throw actorNotAllowed("This counter cannot sell tickets right now.");
    }

    return staff;
  }

  private async placeLocked(
    command: PlaceBetCommand,
    key: string,
    staff: CounterStaff | undefined,
  ): Promise<PlacementResult> {
    // A concurrent retry waited on the lock; the first attempt has committed by now.
    const earlier = await this.deps.bets.findByIdempotencyKey(key);

    if (earlier !== undefined) {
      return { ...earlier, replayed: true };
    }

    const placedAt = this.deps.now();
    const legs = await this.priceLegs(command.legs, placedAt);
    const price = priceSlip(
      command.stake,
      legs.map((leg) => leg.oddsHundredths),
    );

    if (price === undefined) {
      throw invalidBet("The combined odds of this slip are too large to accept.");
    }

    const decision = await this.assess(command, legs);
    const betId = crypto.randomUUID();
    const ticket =
      staff === undefined
        ? undefined
        : await this.draftTicket(command, staff, legs);

    const bet: NewBet = {
      id: betId,
      userId: command.channel === "ONLINE" ? command.actor.id : undefined,
      channel: command.channel,
      shopId: ticket?.shopId,
      cashierId: ticket?.cashierId,
      stake: command.stake,
      currency: CURRENCY,
      totalOddsHundredths: price.totalOddsHundredths,
      potentialPayout: price.potentialPayout,
      riskDecisionId: decision.decisionId,
      idempotencyKey: key,
      placedAt,
      legs,
      ticket,
    };

    const plan = stakePlan(bet);

    await this.takeStake(plan, command, betId);

    const written = await this.writeOrReturnStake(bet, plan, command);

    if (written.replayed) {
      return written;
    }

    this.deps.logger.info("Bet accepted", {
      requestId: command.requestId,
      betId,
      event: "bet_accepted",
      channel: bet.channel,
      legs: legs.length,
    });

    if (written.ticket !== undefined) {
      void this.deps.identity.recordAudit({
        actorId: command.actor.id,
        actorRole: command.actor.role,
        action: AUDIT_ACTION.TICKET_SOLD,
        entityType: "ticket",
        entityId: written.ticket.id,
        after: { code: written.ticket.code, stake: bet.stake, betId },
        requestId: command.requestId,
      });
    }

    return written;
  }

  private async writeOrReturnStake(
    bet: NewBet,
    plan: StakePlan,
    command: PlaceBetCommand,
  ): Promise<PlacementResult> {
    try {
      return { ...(await this.deps.bets.insert(bet)), replayed: false };
    } catch (error) {
      this.deps.logger.error("Bet could not be written after the stake moved", {
        requestId: command.requestId,
        betId: bet.id,
        event: "bet_insert_failed",
        error: error instanceof Error ? error.message : String(error),
      });

      await this.returnStake(plan, command, bet.id);

      // A concurrent request with the same key won the unique index: its bet is this caller's bet.
      const winner = await this.deps.bets
        .findByIdempotencyKey(bet.idempotencyKey)
        .catch(() => undefined);

      if (winner !== undefined) {
        return { ...winner, replayed: true };
      }

      throw error;
    }
  }

  private async priceLegs(
    submitted: readonly SubmittedLeg[],
    now: Date,
  ): Promise<readonly NewBetLeg[]> {
    const snapshots = await this.deps.markets.loadLegs(
      submitted.map((leg) => leg.selectionId),
    );
    const bySelection = new Map(
      snapshots.map((snapshot) => [snapshot.selectionId, snapshot]),
    );

    const matched = submitted.map((leg) => {
      const snapshot = bySelection.get(leg.selectionId);

      if (
        snapshot === undefined ||
        snapshot.marketId !== leg.marketId ||
        snapshot.marketMatchId !== leg.matchId ||
        snapshot.selectionMatchId !== leg.matchId
      ) {
        throw invalidBet("A selection on this slip does not exist.");
      }

      return { leg, snapshot };
    });

    const closedMatches = matched.filter(
      ({ snapshot }) =>
        !OPEN_LIFECYCLES.includes(snapshot.lifecycle) ||
        snapshot.bettingClosesAt.getTime() <= now.getTime(),
    );

    if (closedMatches.length > 0) {
      throw marketClosed(
        "Betting has closed on one of these matches.",
        closedMatches.map(({ leg }) => leg.selectionId),
      );
    }

    const closedMarkets = matched.filter(
      ({ snapshot }) => snapshot.marketStatus !== OPEN_MARKET_STATUS,
    );

    if (closedMarkets.length > 0) {
      throw marketClosed(
        "One of these markets is not open for betting.",
        closedMarkets.map(({ leg }) => leg.selectionId),
      );
    }

    const priced = matched.map(({ leg, snapshot }) => ({
      leg,
      snapshot,
      hundredths: parseHundredths(snapshot.odds),
    }));

    if (
      priced.some(
        ({ leg, hundredths }) => submittedHundredths(leg.odds) !== hundredths,
      )
    ) {
      throw oddsChanged(
        priced.map(({ snapshot, hundredths }) => ({
          selectionId: snapshot.selectionId,
          odds: hundredths / 100,
          oddsVersion: snapshot.oddsVersion,
        })),
      );
    }

    return priced.map(({ snapshot, hundredths }) =>
      acceptedLeg(snapshot, hundredths),
    );
  }

  private async assess(
    command: PlaceBetCommand,
    legs: readonly NewBetLeg[],
  ): Promise<RiskDecision> {
    let decision: RiskDecision;

    try {
      decision = await this.deps.risk.evaluate(
        {
          actor: {
            kind: command.channel === "ONLINE" ? "CUSTOMER" : "CASHIER",
            id: command.actor.id,
            ...(command.actor.shopId === undefined
              ? {}
              : { shopId: command.actor.shopId }),
          },
          stake: command.stake,
          legs: legs.map((leg) => ({
            matchId: asId<"MatchId">(leg.matchId),
            marketId: asId<"MarketId">(leg.marketId),
            selectionId: asId<"SelectionId">(leg.selectionId),
            odds: leg.oddsHundredths / 100,
          })),
        },
        command.requestId,
      );
    } catch (error) {
      this.deps.logger.error("Risk did not decide; the bet is refused", {
        requestId: command.requestId,
        event: "risk_unavailable",
        error: error instanceof Error ? error.message : String(error),
      });

      throw riskUnavailable();
    }

    if (decision.decision === "LIMIT") {
      throw stakeLimited(decision.maxStake);
    }

    if (decision.decision === "REJECT") {
      const message = RISK_REJECTION_MESSAGE[decision.reason];

      throw decision.reason === "MARKET_CLOSED" ||
        decision.reason === "MARKET_SUSPENDED"
        ? marketClosed(message)
        : riskRejected(message);
    }

    return decision;
  }

  private async draftTicket(
    command: PlaceBetCommand,
    staff: CounterStaff,
    legs: readonly NewBetLeg[],
  ): Promise<NewTicket> {
    const shopId = command.actor.shopId;

    if (shopId === undefined) {
      throw actorNotAllowed("This cashier is not attached to a shop.");
    }

    const lastKickoff = Math.max(...legs.map((leg) => leg.kickoffAt.getTime()));

    return {
      code: await this.unusedTicketCode(),
      shopId,
      shopCode: staff.shopCode,
      cashierId: command.actor.id,
      cashierName: staff.cashierName.slice(0, 60),
      customerName: emptyToUndefined(command.customerName),
      customerPhone: emptyToUndefined(command.customerPhone),
      expiresAt: new Date(lastKickoff + TICKET.validityDays * DAY_MS),
    };
  }

  private async unusedTicketCode(): Promise<string> {
    for (let attempt = 0; attempt < TICKET.codeAttempts; attempt += 1) {
      const code = generateTicketCode();

      if (!(await this.deps.bets.ticketCodeExists(code))) {
        return code;
      }
    }

    throw new Error("Could not find an unused ticket code.");
  }

  private async takeStake(
    plan: StakePlan,
    command: PlaceBetCommand,
    betId: string,
  ): Promise<void> {
    const attempt = async (): Promise<void> =>
      this.deps.wallet[plan.take](plan.movement, command.requestId);

    try {
      await attempt();
      return;
    } catch (error) {
      if (error instanceof PeerRefusedError) {
        throw stakeRefused(error, command);
      }
    }

    // Outcome unknown. The movement is idempotent on its key, so one retry is safe.
    try {
      await attempt();
    } catch (error) {
      if (error instanceof PeerRefusedError) {
        throw stakeRefused(error, command);
      }

      this.deps.logger.error("Stake outcome unknown; the bet was not written", {
        requestId: command.requestId,
        betId,
        event: "stake_outcome_unknown",
        idempotencyKey: plan.movement.idempotencyKey,
      });

      throw upstreamUnavailable(
        "The wallet could not be reached. The bet was not placed.",
      );
    }
  }

  private async returnStake(
    plan: StakePlan,
    command: PlaceBetCommand,
    betId: string,
  ): Promise<void> {
    const back = plan.take === "debit" ? "credit" : "debit";

    try {
      await this.deps.wallet[back](plan.undo, command.requestId);

      this.deps.logger.warn("Stake returned", {
        requestId: command.requestId,
        betId,
        event: "stake_returned",
      });
    } catch (error) {
      this.deps.logger.error("Stake could not be returned", {
        requestId: command.requestId,
        betId,
        event: "stake_return_failed",
        idempotencyKey: plan.undo.idempotencyKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function assertSlipShape(legs: readonly SubmittedLeg[]): void {
  if (legs.length === 0 || legs.length > MAX_LEGS) {
    throw invalidBet(
      `A slip carries between 1 and ${String(MAX_LEGS)} selections.`,
    );
  }

  if (new Set(legs.map((leg) => leg.matchId)).size !== legs.length) {
    throw invalidBet("A slip may carry one selection per match.");
  }
}

// Scoped to the actor so one caller's key can never return another's bet.
function scopedKey(command: PlaceBetCommand): string {
  return `${command.actor.kind}:${command.actor.id}:${command.idempotencyKey}`;
}

function acceptedLeg(snapshot: LegSnapshot, oddsHundredths: number): NewBetLeg {
  const lineTenths =
    snapshot.line === null ? undefined : parseTenths(snapshot.line);

  return {
    matchId: snapshot.marketMatchId,
    marketId: snapshot.marketId,
    selectionId: snapshot.selectionId,
    leagueId: snapshot.leagueId,
    marketType: snapshot.marketType.slice(0, 32),
    selectionCode: snapshot.selectionCode.slice(0, 32),
    lineTenths,
    oddsHundredths,
    oddsVersion: snapshot.oddsVersion,
    marketLabel: marketLabel(snapshot.marketType, lineTenths).slice(0, 64),
    selectionLabel: snapshot.selectionLabel.slice(0, 64),
    matchLabel: `${snapshot.homeName} vs ${snapshot.awayName}`.slice(0, 160),
    leagueName: snapshot.leagueName.slice(0, 120),
    kickoffAt: snapshot.kickoffAt,
  };
}

// Online the stake leaves the customer's wallet; at the counter cash came in, so the sale credits the shop float.
function stakePlan(bet: NewBet): StakePlan {
  if (bet.ticket === undefined) {
    const owner = {
      ownerType: "CUSTOMER",
      ownerId: bet.userId ?? "",
      amount: bet.stake,
      reference: bet.id,
    } as const;

    return {
      take: "debit",
      movement: {
        ...owner,
        type: "BET_STAKE",
        idempotencyKey: `bet:${bet.id}`,
      },
      undo: {
        ...owner,
        type: "BET_REFUND",
        idempotencyKey: `bet-rollback:${bet.id}`,
      },
    };
  }

  const drawer = {
    ownerType: "SHOP",
    ownerId: bet.ticket.shopId,
    amount: bet.stake,
    reference: bet.ticket.code,
    actorId: bet.ticket.cashierId,
  } as const;

  return {
    take: "credit",
    movement: {
      ...drawer,
      type: "TICKET_SALE",
      idempotencyKey: `ticket-sale:${bet.id}`,
    },
    undo: {
      ...drawer,
      type: "TICKET_CANCEL",
      idempotencyKey: `bet-rollback:${bet.id}`,
    },
  };
}

function stakeRefused(error: PeerRefusedError, command: PlaceBetCommand): Error {
  if (error.code === "INSUFFICIENT_FUNDS") {
    return insufficientFunds(
      command.channel === "ONLINE"
        ? "Your balance does not cover this stake."
        : "The shop float cannot take this sale.",
    );
  }

  return stakeNotTaken();
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}
