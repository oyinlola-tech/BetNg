import {
  createResponseContext,
  parseBody,
  parseQuery,
  requireParam,
} from "@betng/service-kit";
import type {
  HttpResponseContext,
  HttpRouterContext,
} from "@betng/service-kit";
import type { Ticket } from "@betng/contracts";
import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import { validate } from "@zudojs/validation";
import { PERMISSION } from "../constants/index.js";
import { toTicketDto } from "../dtos/index.js";
import type { TicketListDto } from "../dtos/index.js";
import { ticketNotFound } from "../errors/index.js";
import type { TicketRecord } from "../interfaces/index.js";
import { PlaceBetCommand } from "../services/betting/commands/index.js";
import type { PlacementResult } from "../services/betting/commands/index.js";
import {
  CancelTicketCommand,
  PayoutTicketCommand,
} from "../services/ticket/commands/index.js";
import {
  GetTicketQuery,
  ListTicketsQuery,
} from "../services/ticket/queries/index.js";
import {
  cancelTicketValidator,
  listTicketsQueryValidator,
  payoutTicketValidator,
  placeTicketValidator,
  ticketCodeValidator,
} from "../validators/index.js";
import {
  assertLegCount,
  getRequestId,
  readIdempotencyKey,
  requireCounter,
  requireValidActor,
} from "./request.helper.js";

export interface TicketController {
  readonly sellTicket: (context: HttpRouterContext) => Promise<HttpResponseContext>;
  readonly listTickets: (context: HttpRouterContext) => Promise<TicketListDto>;
  readonly getTicket: (context: HttpRouterContext) => Promise<Ticket>;
  readonly payoutTicket: (context: HttpRouterContext) => Promise<Ticket>;
  readonly cancelTicket: (context: HttpRouterContext) => Promise<Ticket>;
}

export interface TicketControllerOptions {
  readonly commandBus: CommandBus;
  readonly queryBus: QueryBus;
  readonly now: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function readTicketCode(context: HttpRouterContext): string {
  const code = validate(
    ticketCodeValidator,
    requireParam(context.params, "code"),
  );

  if (!code.success) {
    throw ticketNotFound();
  }

  return code.data;
}

export function createTicketController(
  options: TicketControllerOptions,
): TicketController {
  const { commandBus, queryBus, now } = options;

  return {
    sellTicket: async (context) => {
      const actor = requireValidActor(context.request, {
        kind: "CASHIER",
        permission: PERMISSION.TICKETS_SELL,
      });

      assertLegCount(context.request);

      const request = parseBody(context.request, placeTicketValidator);

      const placed = await commandBus.execute<PlaceBetCommand, PlacementResult>(
        new PlaceBetCommand({
          channel: "SHOP",
          actor,
          legs: request.selections,
          stake: request.stake,
          idempotencyKey: readIdempotencyKey(context.request),
          customerName: request.customerName,
          customerPhone: request.customerPhone,
          requestId: getRequestId(context.request),
        }),
      );

      if (placed.ticket === undefined) {
        throw new Error(`Shop bet ${placed.bet.id} was written without a ticket.`);
      }

      return createResponseContext({
        status: placed.replayed ? 200 : 201,
      }).json(toTicketDto(placed.ticket, now()));
    },

    listTickets: async (context) => {
      const counter = requireCounter(context.request, PERMISSION.TICKETS_CHECK);
      const query = parseQuery(context.query, listTicketsQueryValidator);
      const current = now();

      let soldBetween: readonly [Date, Date] | undefined;

      if (query.date !== undefined) {
        const start = new Date(`${query.date}T00:00:00.000Z`);

        soldBetween = [start, new Date(start.getTime() + DAY_MS)];
      }

      const tickets = await queryBus.execute<
        ListTicketsQuery,
        readonly TicketRecord[]
      >(
        new ListTicketsQuery({
          shopId: counter.shopId,
          status: query.status,
          search: query.q,
          soldBetween,
          limit: query.limit,
          now: current,
        }),
      );

      return { items: tickets.map((ticket) => toTicketDto(ticket, current)) };
    },

    getTicket: async (context) => {
      const counter = requireCounter(context.request, PERMISSION.TICKETS_CHECK);

      return toTicketDto(
        await queryBus.execute<GetTicketQuery, TicketRecord>(
          new GetTicketQuery(readTicketCode(context), counter.shopId),
        ),
        now(),
      );
    },

    payoutTicket: async (context) => {
      const counter = requireCounter(context.request, PERMISSION.TICKETS_PAYOUT);
      const code = readTicketCode(context);
      const request = parseBody(context.request, payoutTicketValidator);

      return toTicketDto(
        await commandBus.execute<PayoutTicketCommand, TicketRecord>(
          new PayoutTicketCommand({
            code,
            pin: request.pin,
            counter,
            requestId: getRequestId(context.request),
          }),
        ),
        now(),
      );
    },

    cancelTicket: async (context) => {
      const counter = requireCounter(context.request, PERMISSION.TICKETS_CANCEL);
      const code = readTicketCode(context);
      const request = parseBody(context.request, cancelTicketValidator);

      return toTicketDto(
        await commandBus.execute<CancelTicketCommand, TicketRecord>(
          new CancelTicketCommand({
            code,
            reason: request.reason,
            counter,
            requestId: getRequestId(context.request),
          }),
        ),
        now(),
      );
    },
  };
}
