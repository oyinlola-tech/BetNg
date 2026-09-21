import { CommandHandler } from "@zudojs/cqrs";
import type { Logger } from "@betng/service-kit";
import {
  AUDIT_ACTION,
  BETTING_COMMAND,
  OPEN_LIFECYCLES,
} from "../../../../constants/index.js";
import { effectiveTicketStatus, toTicketDto } from "../../../../dtos/index.js";
import {
  insufficientFunds,
  marketClosed,
  PeerRefusedError,
  stakeNotTaken,
  ticketConflict,
  ticketNotFound,
  upstreamUnavailable,
} from "../../../../errors/index.js";
import type {
  BetRepository,
  IdentityPeer,
  MarketReader,
  TicketRecord,
  WalletPeer,
} from "../../../../interfaces/index.js";
import type { CancelTicketCommand } from "./cancelTicket.command.js";

export interface CancelTicketDependencies {
  readonly bets: BetRepository;
  readonly markets: MarketReader;
  readonly wallet: WalletPeer;
  readonly identity: IdentityPeer;
  readonly logger: Logger;
  readonly now: () => Date;
}

// Only while every leg still takes bets: after close a result may exist, and cancelling would withdraw a losing bet.
// The float debit runs inside the cancelling transaction, so neither happens alone.
export class CancelTicketHandler extends CommandHandler<
  CancelTicketCommand,
  TicketRecord
> {
  public readonly commandType = BETTING_COMMAND.CANCEL_TICKET;

  private readonly deps: CancelTicketDependencies;

  public constructor(dependencies: CancelTicketDependencies) {
    super();
    this.deps = dependencies;
  }

  public async execute(command: CancelTicketCommand): Promise<TicketRecord> {
    const { counter } = command;
    const ticket = await this.deps.bets.findTicket(command.code, counter.shopId);

    if (ticket === undefined) {
      throw ticketNotFound();
    }

    const now = this.deps.now();

    if (effectiveTicketStatus(ticket, now) !== "OPEN") {
      throw ticketConflict(
        "Only an open ticket can be cancelled.",
        toTicketDto(ticket, now),
      );
    }

    await this.assertStillOpen(ticket, now);

    const result = await this.deps.bets.cancelTicket({
      ticketId: ticket.id,
      reason: command.reason,
      now,
      moveMoney: async (stake) => this.debitFloat(command, ticket, stake),
    });

    const current =
      (await this.deps.bets.findTicket(ticket.code, ticket.shopId)) ?? ticket;

    if (result.kind === "NOT_CANCELLABLE") {
      throw ticketConflict(
        "Only an open ticket can be cancelled.",
        toTicketDto(current, now),
      );
    }

    this.deps.logger.info("Ticket cancelled", {
      requestId: command.requestId,
      betId: ticket.bet.id,
      event: "ticket_cancelled",
      ticketId: ticket.id,
    });

    void this.deps.identity.recordAudit({
      actorId: counter.cashierId,
      actorRole: counter.role,
      action: AUDIT_ACTION.TICKET_CANCELLED,
      entityType: "ticket",
      entityId: ticket.id,
      before: { status: ticket.status },
      after: { status: "CANCELLED", refunded: ticket.bet.stake },
      reason: command.reason,
      requestId: command.requestId,
    });

    return current;
  }

  private async assertStillOpen(ticket: TicketRecord, now: Date): Promise<void> {
    const matchIds = [...new Set(ticket.bet.legs.map((leg) => leg.matchId))];
    const windows = await this.deps.markets.loadMatchWindows(matchIds);

    const open = windows.filter(
      (window) =>
        OPEN_LIFECYCLES.includes(window.lifecycle) &&
        window.bettingClosesAt.getTime() > now.getTime(),
    );

    if (open.length !== matchIds.length) {
      throw marketClosed(
        "Betting has closed on this ticket; it can no longer be cancelled.",
      );
    }
  }

  private async debitFloat(
    command: CancelTicketCommand,
    ticket: TicketRecord,
    stake: number,
  ): Promise<void> {
    try {
      await this.deps.wallet.debit(
        {
          ownerType: "SHOP",
          ownerId: ticket.shopId,
          amount: stake,
          type: "TICKET_CANCEL",
          idempotencyKey: `ticket-cancel:${ticket.id}`,
          reference: ticket.code,
          actorId: command.counter.cashierId,
        },
        command.requestId,
      );
    } catch (error) {
      if (error instanceof PeerRefusedError) {
        throw error.code === "INSUFFICIENT_FUNDS"
          ? insufficientFunds("The shop float does not cover this refund.")
          : stakeNotTaken();
      }

      throw upstreamUnavailable(
        "The wallet could not be reached. The ticket was not cancelled.",
      );
    }
  }
}
