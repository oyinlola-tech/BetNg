/**
 * Applies a settlement's effects and stamps it.
 *
 * Effects are what settlement causes outside its own schema: the bet's status in betting, and for an online
 * bet the customer's payout or refund in wallet. Each is idempotent on the callee's side — by bet, and by the
 * wallet idempotency key — so re-applying after a partial failure cannot pay twice. `effects_applied_at` is
 * stamped only after every effect succeeded; an un-stamped settlement is what the retry loop picks up.
 *
 * A shop ticket moves no wallet money here: the cashier pays at the counter and betting debits the float
 * then. Nothing in this file can debit anything, and no credit goes to anyone but the customer who placed
 * the bet.
 */

import type { Logger } from "@betng/service-kit";
import { WALLET_KEY } from "../../constants/index.js";
import type {
  BettingPeer,
  SettlementRepository,
  WalletCreditRequest,
  WalletPeer,
} from "../../interfaces/index.js";
import type { SettlementRecord } from "../../models/index.js";
import { toSafeNumber } from "../../utils/index.js";

export interface EffectsApplierDependencies {
  readonly settlements: SettlementRepository;
  readonly betting: BettingPeer;
  readonly wallet: WalletPeer;
  readonly logger: Logger;
}

/** The customer credit a settlement calls for, or undefined when no money moves. */
export function customerCreditFor(settlement: SettlementRecord): WalletCreditRequest | undefined {
  if (settlement.channel !== "ONLINE" || settlement.outcome === "LOST" || settlement.payout <= 0n) {
    return undefined;
  }

  if (settlement.userId === null) {
    throw new Error("An online bet has no customer to pay.");
  }

  const won = settlement.outcome === "WON";

  return {
    ownerType: "CUSTOMER",
    ownerId: settlement.userId,
    amount: toSafeNumber(settlement.payout),
    type: won ? "BET_PAYOUT" : "BET_REFUND",
    idempotencyKey: won ? WALLET_KEY.payout(settlement.betId) : WALLET_KEY.refund(settlement.betId),
    reference: settlement.id,
    note: won ? "Winning bet payout" : "Void bet stake refund",
  };
}

export class EffectsApplier {
  private readonly settlements: SettlementRepository;
  private readonly betting: BettingPeer;
  private readonly wallet: WalletPeer;
  private readonly logger: Logger;

  /** One application per settlement at a time in this process; the retry loop and a settle call share it. */
  private readonly inFlight = new Map<string, Promise<void>>();

  public constructor(dependencies: EffectsApplierDependencies) {
    this.settlements = dependencies.settlements;
    this.betting = dependencies.betting;
    this.wallet = dependencies.wallet;
    this.logger = dependencies.logger;
  }

  public async apply(settlement: SettlementRecord, requestId: string): Promise<void> {
    if (settlement.effectsAppliedAt !== null) {
      return;
    }

    const running = this.inFlight.get(settlement.id);

    if (running !== undefined) {
      return running;
    }

    const application = this.run(settlement, requestId).finally(() => {
      this.inFlight.delete(settlement.id);
    });

    this.inFlight.set(settlement.id, application);

    return application;
  }

  private async run(settlement: SettlementRecord, requestId: string): Promise<void> {
    await this.betting.applySettlement(
      {
        betId: settlement.betId,
        outcome: settlement.outcome,
        payout: toSafeNumber(settlement.payout),
        legs: settlement.legs.map((leg) => ({
          selectionId: leg.selectionId,
          outcome: leg.outcome,
          result: leg.result,
        })),
        settledAt: settlement.settledAt.toISOString(),
      },
      requestId,
    );

    const credit = customerCreditFor(settlement);

    if (credit !== undefined) {
      const result = await this.wallet.credit(credit, requestId);

      this.logger.info("Customer credited", {
        requestId,
        betId: settlement.betId,
        settlementId: settlement.id,
        type: credit.type,
        duplicate: result.duplicate,
      });
    }

    await this.settlements.stampEffects(settlement.id);
  }
}
