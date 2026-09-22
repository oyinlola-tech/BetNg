// Effects are idempotent on the callee (by bet, by wallet key); `effects_applied_at` is stamped only after all
// succeeded. Shop tickets move no wallet money here, and nothing in this file can debit anyone. The customer is
// told only after the stamp, and telling them is not an effect: it cannot fail or hold up a settlement.

import type { Logger } from "@betng/service-kit";
import { WALLET_KEY } from "../../constants/index.js";
import { SettlementDataError } from "../../errors/index.js";
import type {
  BettingPeer,
  SettlementNotifier,
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
  readonly notifier: SettlementNotifier;
  readonly logger: Logger;
}

export function customerCreditFor(settlement: SettlementRecord): WalletCreditRequest | undefined {
  if (settlement.channel !== "ONLINE" || settlement.outcome === "LOST" || settlement.payout <= 0n) {
    return undefined;
  }

  if (settlement.userId === null) {
    throw new SettlementDataError("An online bet has no customer to pay.");
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
  private readonly notifier: SettlementNotifier;
  private readonly logger: Logger;

  // The retry loop and a settle call must not apply the same settlement side by side.
  private readonly inFlight = new Map<string, Promise<void>>();

  public constructor(dependencies: EffectsApplierDependencies) {
    this.settlements = dependencies.settlements;
    this.betting = dependencies.betting;
    this.wallet = dependencies.wallet;
    this.notifier = dependencies.notifier;
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

    this.notifier.settled(settlement, requestId);
  }
}
