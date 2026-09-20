/**
 * The domain events the wallet service publishes.
 *
 * An entry on the ledger is the one thing other parts of the platform will
 * need to react to — a notification on a payout, a risk recalculation when
 * exposure moves. Publishing it now means those consumers can be added
 * without changing the wallet service.
 *
 * SIMULATED FUNDS ONLY: an event here describes play money.
 */

import { defineEvent } from "@zudojs/events";
import type { Currency, TransactionType } from "@betng/contracts";

export interface LedgerEntryAppendedPayload {
  readonly walletId: string;
  readonly userId: string;
  readonly transactionId: string;
  readonly type: TransactionType;
  readonly amount: number;
  readonly balanceAfter: number;
  readonly currency: Currency;
}

export const LedgerEntryAppendedEvent = defineEvent<
  "wallet.ledgerEntryAppended",
  LedgerEntryAppendedPayload
>("wallet.ledgerEntryAppended");
