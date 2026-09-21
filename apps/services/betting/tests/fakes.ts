import type { RiskDecision, RiskEvaluateRequest } from "@betng/contracts";
import { PeerRefusedError, PeerUnavailableError } from "../src/errors/index.js";
import type {
  AuditEntry,
  IdentityPeer,
  RiskPeer,
  WalletMovement,
  WalletPeer,
} from "../src/interfaces/index.js";

export class FakeRisk implements RiskPeer {
  public readonly calls: RiskEvaluateRequest[] = [];

  public next: Omit<RiskDecision, "decisionId"> | "DOWN" = {
    decision: "ACCEPT",
    reason: "WITHIN_LIMIT",
    maxStake: 10_000_000,
  };

  public async evaluate(request: RiskEvaluateRequest): Promise<RiskDecision> {
    this.calls.push(request);

    if (this.next === "DOWN") {
      throw new PeerUnavailableError("risk", new Error("connection refused"));
    }

    return Promise.resolve({ decisionId: crypto.randomUUID(), ...this.next });
  }
}

export interface LedgerEntry extends WalletMovement {
  readonly direction: "debit" | "credit";
}

/** An idempotent ledger: a repeated key moves nothing, an overdraft is refused. */
export class FakeWallet implements WalletPeer {
  public readonly calls: LedgerEntry[] = [];

  public readonly ledger = new Map<string, LedgerEntry>();

  public readonly balances = new Map<string, number>();

  public down = false;

  public balanceOf(ownerId: string): number {
    return this.balances.get(ownerId) ?? 0;
  }

  public async debit(movement: WalletMovement): Promise<void> {
    return this.move("debit", movement);
  }

  public async credit(movement: WalletMovement): Promise<void> {
    return this.move("credit", movement);
  }

  private async move(
    direction: "debit" | "credit",
    movement: WalletMovement,
  ): Promise<void> {
    this.calls.push({ ...movement, direction });

    if (this.down) {
      throw new PeerUnavailableError("wallet", new Error("connection refused"));
    }

    await new Promise((resolve) => setTimeout(resolve, 20));

    const key = `${movement.ownerId}:${movement.idempotencyKey}`;

    if (this.ledger.has(key)) {
      return;
    }

    const balance = this.balanceOf(movement.ownerId);
    const next =
      direction === "debit" ? balance - movement.amount : balance + movement.amount;

    if (next < 0) {
      throw new PeerRefusedError("wallet", "INSUFFICIENT_FUNDS");
    }

    this.ledger.set(key, { ...movement, direction });
    this.balances.set(movement.ownerId, next);
  }
}

export const CASHIER_PIN = "4821";

export class FakeIdentity implements IdentityPeer {
  public readonly audits: AuditEntry[] = [];

  public readonly pinChecks: string[] = [];

  public async verifyCashierPin(cashierId: string, pin: string): Promise<boolean> {
    this.pinChecks.push(cashierId);

    return Promise.resolve(pin === CASHIER_PIN);
  }

  public async recordAudit(entry: AuditEntry): Promise<void> {
    this.audits.push(entry);

    return Promise.resolve();
  }
}
