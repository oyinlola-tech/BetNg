import { MONEY_TRANSACTION } from "../constants/index.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type {
  BetLegRecord,
  BetRecord,
  BetRepository,
  SettlementInput,
  SettlementResult,
  TicketFilter,
  TicketRecord,
} from "../interfaces/index.js";
import {
  formatHundredths,
  formatTenths,
  parseHundredths,
  parseTenths,
} from "../utils/index.js";

const WITH_LEGS = {
  selections: { orderBy: [{ kickoffAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.BetInclude;

const WITH_BET = { bet: { include: WITH_LEGS } } satisfies Prisma.TicketInclude;

type BetRow = Prisma.BetGetPayload<{ include: typeof WITH_LEGS }>;

type TicketRow = Prisma.TicketGetPayload<{ include: typeof WITH_BET }>;

interface DecimalLike {
  toFixed(places: number): string;
}

// Prisma's Decimal type does not resolve under pnpm's strict layout, so it is read structurally.
function decimalText(value: unknown, places: number): string {
  const candidate = value as Partial<DecimalLike> | null;

  if (typeof candidate?.toFixed !== "function") {
    throw new Error("Expected a decimal column value.");
  }

  return (candidate as DecimalLike).toFixed(places);
}

class TransitionRefused extends Error {}

function toLegRecord(row: BetRow["selections"][number]): BetLegRecord {
  return {
    matchId: row.matchId,
    marketId: row.marketId,
    selectionId: row.selectionId,
    leagueId: row.leagueId,
    marketType: row.marketType,
    selectionCode: row.selectionCode,
    lineTenths: row.line === null ? undefined : parseTenths(decimalText(row.line, 1)),
    oddsHundredths: parseHundredths(decimalText(row.odds, 2)),
    oddsVersion: row.oddsVersion,
    marketLabel: row.marketLabel,
    selectionLabel: row.selectionLabel,
    matchLabel: row.matchLabel,
    leagueName: row.leagueName,
    kickoffAt: row.kickoffAt,
    outcome: row.outcome,
    result: row.result ?? undefined,
  };
}

function toBetRecord(row: BetRow): BetRecord {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    channel: row.channel,
    shopId: row.shopId ?? undefined,
    cashierId: row.cashierId ?? undefined,
    stake: Number(row.stake),
    currency: row.currency,
    totalOddsHundredths: parseHundredths(decimalText(row.totalOdds, 2)),
    potentialPayout: Number(row.potentialPayout),
    status: row.status,
    payout: row.payout === null ? undefined : Number(row.payout),
    placedAt: row.placedAt,
    settledAt: row.settledAt ?? undefined,
    cancelledAt: row.cancelledAt ?? undefined,
    legs: row.selections.map(toLegRecord),
  };
}

function toTicketRecord(row: TicketRow): TicketRecord {
  return {
    id: row.id,
    code: row.code,
    shopId: row.shopId,
    shopCode: row.shopCode,
    cashierId: row.cashierId,
    cashierName: row.cashierName,
    customerName: row.customerName ?? undefined,
    customerPhone: row.customerPhone ?? undefined,
    status: row.status,
    paidAt: row.paidAt ?? undefined,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    bet: toBetRecord(row.bet),
  };
}

function ticketStatusFilter(
  filter: TicketFilter,
): Prisma.TicketWhereInput | undefined {
  switch (filter.status) {
    case undefined:
      return undefined;
    case "PENDING":
      return { status: "OPEN" };
    case "EXPIRED":
      return {
        OR: [
          { status: "EXPIRED" },
          { status: { in: ["WON", "VOID"] }, expiresAt: { lte: filter.now } },
        ],
      };
    case "WON":
    case "VOID":
      return { status: filter.status, expiresAt: { gt: filter.now } };
    default:
      return { status: filter.status };
  }
}

function ticketSearchFilter(
  search: string | undefined,
): Prisma.TicketWhereInput | undefined {
  return search === undefined
    ? undefined
    : {
        OR: [
          { code: { contains: search.toUpperCase() } },
          { customerName: { contains: search, mode: "insensitive" } },
          { customerPhone: { contains: search } },
        ],
      };
}

async function settle(
  tx: Prisma.TransactionClient,
  input: SettlementInput,
): Promise<SettlementResult> {
  // Serialises settlement against ticket cancellation, which locks the bet row first too.
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM betting.bets WHERE id = ${input.betId}::uuid FOR UPDATE
  `;

  if (locked.length === 0) {
    return { kind: "NOT_FOUND" };
  }

  const bet = await tx.bet.findUniqueOrThrow({
    where: { id: input.betId },
    include: { selections: true },
  });

  if (bet.status === "CANCELLED") {
    return { kind: "UNCHANGED", status: "CANCELLED" };
  }

  if (bet.status !== "PENDING") {
    return bet.status === input.outcome && bet.payout === BigInt(input.payout)
      ? { kind: "UNCHANGED", status: bet.status }
      : { kind: "CONFLICT", status: bet.status };
  }

  const known = new Set(bet.selections.map((leg) => leg.selectionId));
  const stranger = input.legs.find((leg) => !known.has(leg.selectionId));

  if (stranger !== undefined) {
    return { kind: "UNKNOWN_LEG", selectionId: stranger.selectionId };
  }

  const payout = BigInt(input.payout);
  const payoutIsConsistent =
    input.outcome === "LOST"
      ? payout === 0n
      : input.outcome === "VOID"
        ? payout === bet.stake
        : payout > 0n && payout <= bet.potentialPayout;

  if (!payoutIsConsistent) {
    return { kind: "INVALID_PAYOUT" };
  }

  for (const leg of input.legs) {
    await tx.betSelection.updateMany({
      where: {
        betId: bet.id,
        selectionId: leg.selectionId,
        outcome: "PENDING",
      },
      data: { outcome: leg.outcome, result: leg.result ?? null },
    });
  }

  const resolved = await tx.bet.updateMany({
    where: { id: bet.id, status: "PENDING" },
    data: {
      status: input.outcome,
      payout,
      settledAt: input.settledAt,
    },
  });

  if (resolved.count !== 1) {
    throw new Error(`Bet ${bet.id} changed while it was locked.`);
  }

  await tx.ticket.updateMany({
    where: { betId: bet.id, status: "OPEN" },
    data: { status: input.outcome },
  });

  return { kind: "APPLIED", status: input.outcome };
}

export function createBetRepository(prisma: PrismaClient): BetRepository {
  return {
    insert: async (bet) => {
      const row = await prisma.bet.create({
        data: {
          id: bet.id,
          userId: bet.userId ?? null,
          channel: bet.channel,
          shopId: bet.shopId ?? null,
          cashierId: bet.cashierId ?? null,
          stake: BigInt(bet.stake),
          currency: bet.currency,
          totalOdds: formatHundredths(bet.totalOddsHundredths),
          potentialPayout: BigInt(bet.potentialPayout),
          riskDecisionId: bet.riskDecisionId,
          idempotencyKey: bet.idempotencyKey,
          placedAt: bet.placedAt,
          selections: {
            create: bet.legs.map((leg) => ({
              matchId: leg.matchId,
              marketId: leg.marketId,
              selectionId: leg.selectionId,
              leagueId: leg.leagueId,
              marketType: leg.marketType,
              selectionCode: leg.selectionCode,
              line:
                leg.lineTenths === undefined
                  ? null
                  : formatTenths(leg.lineTenths),
              odds: formatHundredths(leg.oddsHundredths),
              oddsVersion: leg.oddsVersion,
              marketLabel: leg.marketLabel,
              selectionLabel: leg.selectionLabel,
              matchLabel: leg.matchLabel,
              leagueName: leg.leagueName,
              kickoffAt: leg.kickoffAt,
            })),
          },
          ...(bet.ticket === undefined
            ? {}
            : {
                ticket: {
                  create: {
                    code: bet.ticket.code,
                    shopId: bet.ticket.shopId,
                    shopCode: bet.ticket.shopCode,
                    cashierId: bet.ticket.cashierId,
                    cashierName: bet.ticket.cashierName,
                    customerName: bet.ticket.customerName ?? null,
                    customerPhone: bet.ticket.customerPhone ?? null,
                    expiresAt: bet.ticket.expiresAt,
                    createdAt: bet.placedAt,
                  },
                },
              }),
        },
        include: { ...WITH_LEGS, ticket: true },
      });

      const record = toBetRecord(row);

      return {
        bet: record,
        ticket:
          row.ticket === null
            ? undefined
            : toTicketRecord({ ...row.ticket, bet: row }),
      };
    },

    findBet: async (id) => {
      const row = await prisma.bet.findUnique({
        where: { id },
        include: WITH_LEGS,
      });

      return row === null ? undefined : toBetRecord(row);
    },

    findByIdempotencyKey: async (key) => {
      const row = await prisma.bet.findUnique({
        where: { idempotencyKey: key },
        include: { ...WITH_LEGS, ticket: true },
      });

      if (row === null) {
        return undefined;
      }

      return {
        bet: toBetRecord(row),
        ticket:
          row.ticket === null
            ? undefined
            : toTicketRecord({ ...row.ticket, bet: row }),
      };
    },

    listBets: async (filter) => {
      const rows = await prisma.bet.findMany({
        where: {
          userId: filter.userId,
          ...(filter.status === undefined ? {} : { status: filter.status }),
        },
        include: WITH_LEGS,
        orderBy: [{ placedAt: "desc" }, { id: "desc" }],
        take: filter.limit,
      });

      return rows.map(toBetRecord);
    },

    pageBets: async (filter) => {
      const where = {
        userId: filter.userId,
        ...(filter.status === undefined ? {} : { status: filter.status }),
      };

      const [rows, total] = await prisma.$transaction([
        prisma.bet.findMany({
          where,
          include: WITH_LEGS,
          orderBy: [{ [filter.sort]: filter.direction }, { id: filter.direction }],
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
        }),
        prisma.bet.count({ where }),
      ]);

      return { items: rows.map(toBetRecord), total };
    },

    ticketCodeExists: async (code) =>
      (await prisma.ticket.count({ where: { code } })) > 0,

    findTicket: async (code, shopId) => {
      const row = await prisma.ticket.findFirst({
        where: { code, shopId },
        include: WITH_BET,
      });

      return row === null ? undefined : toTicketRecord(row);
    },

    listTickets: async (filter) => {
      const conditions = [
        ticketStatusFilter(filter),
        ticketSearchFilter(filter.search),
      ].filter((entry): entry is Prisma.TicketWhereInput => entry !== undefined);

      const rows = await prisma.ticket.findMany({
        where: {
          shopId: filter.shopId,
          ...(filter.soldBetween === undefined
            ? {}
            : {
                createdAt: {
                  gte: filter.soldBetween[0],
                  lt: filter.soldBetween[1],
                },
              }),
          AND: conditions,
        },
        include: WITH_BET,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: filter.limit,
      });

      return rows.map(toTicketRecord);
    },

    payTicket: async ({ ticketId, paidBy, now, moveMoney }) =>
      prisma.$transaction(async (tx) => {
        const claimed = await tx.ticket.updateMany({
          where: {
            id: ticketId,
            status: { in: ["WON", "VOID"] },
            expiresAt: { gt: now },
          },
          data: { status: "PAID", paidAt: now, paidBy },
        });

        if (claimed.count !== 1) {
          return { kind: "NOT_PAYABLE" } as const;
        }

        const ticket = await tx.ticket.findUniqueOrThrow({
          where: { id: ticketId },
          include: { bet: true },
        });

        const owed =
          ticket.bet.status === "WON"
            ? ticket.bet.payout
            : ticket.bet.status === "VOID"
              ? ticket.bet.stake
              : null;

        if (owed === null || owed <= 0n) {
          throw new Error(
            `Ticket ${ticketId} is payable but its bet owes nothing.`,
          );
        }

        const amount = Number(owed);

        await moveMoney(amount);

        return { kind: "PAID", amount } as const;
      }, MONEY_TRANSACTION),

    cancelTicket: async ({ ticketId, reason, now, moveMoney }) => {
      try {
        return await prisma.$transaction(async (tx) => {
          const ticket = await tx.ticket.findUniqueOrThrow({
            where: { id: ticketId },
            include: { bet: true },
          });

          // Bet before ticket: the lock order settlement uses.
          const bet = await tx.bet.updateMany({
            where: { id: ticket.betId, status: "PENDING" },
            data: { status: "CANCELLED", cancelledAt: now },
          });

          const counter = await tx.ticket.updateMany({
            where: { id: ticketId, status: "OPEN" },
            data: { status: "CANCELLED", cancelReason: reason },
          });

          if (bet.count !== 1 || counter.count !== 1) {
            throw new TransitionRefused();
          }

          await moveMoney(Number(ticket.bet.stake));

          return { kind: "CANCELLED" } as const;
        }, MONEY_TRANSACTION);
      } catch (error) {
        if (error instanceof TransitionRefused) {
          return { kind: "NOT_CANCELLABLE" };
        }

        throw error;
      }
    },

    markTicketExpired: async (ticketId, now) => {
      await prisma.ticket.updateMany({
        where: {
          id: ticketId,
          status: { in: ["WON", "VOID"] },
          expiresAt: { lte: now },
        },
        data: { status: "EXPIRED" },
      });
    },

    applySettlement: async (input) =>
      prisma.$transaction(async (tx) => settle(tx, input)),
  };
}
