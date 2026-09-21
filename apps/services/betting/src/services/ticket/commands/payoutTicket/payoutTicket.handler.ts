import { CommandHandler } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import { AUDIT_ACTION, BETTING_COMMAND } from "../../../../constants/index.js";
import { effectiveTicketStatus, toTicketDto } from "../../../../dtos/index.js";
import {
  actorNotAllowed,
  insufficientFunds,
  PeerRefusedError,
  PeerUnavailableError,
  stakeNotTaken,
  ticketConflict,
  ticketNotFound,
  upstreamUnavailable,
} from "../../../../errors/index.js";
import type {
  BetRepository,
  IdentityPeer,
  TicketRecord,
  WalletPeer,
} from "../../../../interfaces/index.js";
import type { PayoutTicketCommand } from "./payoutTicket.command.js";

export interface PayoutTicketDependencies {
  readonly bets: BetRepository;
  readonly wallet: WalletPeer;
  readonly identity: IdentityPeer;
  readonly logger: Logger;
  readonly now: () => Date;
}

/**
 * Pays a winning ticket — or refunds a void one — out of the shop's float.
 *
 * Cash leaves the drawer, so the cashier's PIN is checked first. The ticket
 * is claimed with a conditional update and the float is debited inside the
 * same transaction under one idempotency key: two cashiers presenting the
 * same slip pay it once, and a float that cannot cover it leaves the ticket
 * payable.
 */
export class PayoutTicketHandler extends CommandHandler<
  PayoutTicketCommand,
  TicketRecord
> {
  public readonly commandType = BETTING_COMMAND.PAYOUT_TICKET;

  private readonly deps: PayoutTicketDependencies;

  public constructor(dependencies: PayoutTicketDependencies) {
    super();
    this.deps = dependencies;
  }

  public async execute(command: PayoutTicketCommand): Promise<TicketRecord> {
    const { counter } = command;
    const ticket = await this.deps.bets.findTicket(command.code, counter.shopId);

    if (ticket === undefined) {
      throw ticketNotFound();
    }

    await this.verifyPin(command);

    const now = this.deps.now();
    const status = effectiveTicketStatus(ticket, now);

    if (status === "EXPIRED") {
      await this.deps.bets.markTicketExpired(ticket.id, now);
    }

    if (status !== "WON" && status !== "VOID") {
      throw ticketConflict(
        status === "PAID"
          ? "This ticket has already been paid."
          : "This ticket is not payable.",
        toTicketDto(await this.reload(ticket), now),
      );
    }

    const result = await this.deps.bets.payTicket({
      ticketId: ticket.id,
      paidBy: counter.cashierId,
      now,
      moveMoney: async (amount) => this.debitFloat(command, ticket, amount),
    });

    const current = await this.reload(ticket);

    if (result.kind === "NOT_PAYABLE") {
      throw ticketConflict(
        "This ticket has already been paid.",
        toTicketDto(current, now),
      );
    }

    this.deps.logger.info("Ticket paid", {
      requestId: command.requestId,
      betId: ticket.bet.id,
      event: "ticket_paid",
      ticketId: ticket.id,
      amount: result.amount,
    });

    void this.deps.identity.recordAudit({
      actorId: counter.cashierId,
      actorRole: counter.role,
      action: AUDIT_ACTION.TICKET_PAID,
      entityType: "ticket",
      entityId: ticket.id,
      before: { status: ticket.status },
      after: { status: "PAID", amount: result.amount },
      requestId: command.requestId,
    });

    return current;
  }

  private async verifyPin(command: PayoutTicketCommand): Promise<void> {
    let valid: boolean;

    try {
      valid = await this.deps.identity.verifyCashierPin(
        command.counter.cashierId,
        command.pin,
        command.requestId,
      );
    } catch (error) {
      if (
        error instanceof PeerRefusedError ||
        error instanceof PeerUnavailableError
      ) {
        throw upstreamUnavailable(
          "The PIN could not be checked. Nothing was paid.",
        );
      }

      throw error;
    }

    if (!valid) {
      throw actorNotAllowed("The PIN is not correct.");
    }
  }

  private async debitFloat(
    command: PayoutTicketCommand,
    ticket: TicketRecord,
    amount: number,
  ): Promise<void> {
    try {
      await this.deps.wallet.debit(
        {
          ownerType: "SHOP",
          ownerId: ticket.shopId,
          amount,
          type: "TICKET_PAYOUT",
          idempotencyKey: `ticket-payout:${ticket.id}`,
          reference: ticket.code,
          actorId: command.counter.cashierId,
        },
        command.requestId,
      );
    } catch (error) {
      if (error instanceof PeerRefusedError) {
        throw error.code === "INSUFFICIENT_FUNDS"
          ? insufficientFunds("The shop float does not cover this payout.")
          : stakeNotTaken();
      }

      throw upstreamUnavailable(
        "The wallet could not be reached. Nothing was paid.",
      );
    }
  }

  private async reload(ticket: TicketRecord): Promise<TicketRecord> {
    return (
      (await this.deps.bets.findTicket(ticket.code, ticket.shopId)) ?? ticket
    );
  }
}
