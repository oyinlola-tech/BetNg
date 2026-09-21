/**
 * Lifecycle writes.
 *
 * Every state change is a conditional update (`WHERE lifecycle = <expected>`) committed together with its
 * `match_transitions` rows. Two workers racing for the same transition therefore cannot both win: the loser's
 * update matches no row, and it writes nothing.
 */

import type { MatchLifecycle } from "@betng/contracts";
import { LIFECYCLE_STATUS } from "../constants/index.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { MATCH_INCLUDE } from "../interfaces/index.js";
import type { LifecycleRepository } from "../interfaces/index.js";

const UNVOIDABLE: readonly MatchLifecycle[] = ["SETTLEMENT_COMPLETED", "VOIDED"];

function dueNow(now: Date): Prisma.MatchWhereInput {
  return { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] };
}

export function createLifecycleRepository(prisma: PrismaClient): LifecycleRepository {
  return {
    listDue: async (query) =>
      prisma.match.findMany({
        where: {
          lifecycle: { in: [...query.states] },
          ...(query.ignoreLease === true ? {} : dueNow(query.now)),
          ...(query.maxFailures === undefined ? {} : { failureCount: { lt: query.maxFailures } }),
          fixture: {
            ...(query.kickoffBy === undefined ? {} : { kickoffAt: { lte: query.kickoffBy } }),
            ...(query.bettingClosesBy === undefined && query.bettingClosesAfter === undefined
              ? {}
              : {
                  bettingClosesAt: {
                    ...(query.bettingClosesBy === undefined ? {} : { lte: query.bettingClosesBy }),
                    ...(query.bettingClosesAfter === undefined ? {} : { gt: query.bettingClosesAfter }),
                  },
                }),
          },
        },
        include: MATCH_INCLUDE,
        orderBy: [{ fixture: { kickoffAt: "asc" } }, { id: "asc" }],
        take: query.limit,
      }),

    transition: async (input) => {
      const target = input.path[input.path.length - 1];

      if (target === undefined) return false;

      return prisma.$transaction(async (tx) => {
        const updated = await tx.match.updateMany({
          where: { id: input.matchId, lifecycle: input.from },
          data: {
            nextAttemptAt: null,
            ...input.patch,
            lifecycle: target,
            status: LIFECYCLE_STATUS[target],
          },
        });

        if (updated.count !== 1) return false;

        let previous: MatchLifecycle = input.from;
        const rows: Prisma.MatchTransitionCreateManyInput[] = [];

        for (const state of input.path) {
          rows.push({
            matchId: input.matchId,
            fromState: previous,
            toState: state,
            // A millisecond apart, so a chain committed at one instant still reads back in order.
            at: new Date(input.at.getTime() + rows.length),
            actor: input.actor,
            ...(input.reason === undefined ? {} : { reason: input.reason.slice(0, 240) }),
          });
          previous = state;
        }

        await tx.matchTransition.createMany({ data: rows });

        return true;
      });
    },

    claim: async (matchId, state, now, until) => {
      const claimed = await prisma.match.updateMany({
        where: { id: matchId, lifecycle: state, ...dueNow(now) },
        data: { nextAttemptAt: until },
      });

      return claimed.count === 1;
    },

    recordFailure: async (matchId, state, reason, nextAttemptAt) => {
      await prisma.match.updateMany({
        where: { id: matchId, lifecycle: state },
        data: { failureReason: reason.slice(0, 240), failureCount: { increment: 1 }, nextAttemptAt },
      });
    },

    resetAttempts: async (matchId, state, now) => {
      const reset = await prisma.match.updateMany({
        where: { id: matchId, lifecycle: state },
        data: { failureCount: 0, nextAttemptAt: now },
      });

      return reset.count === 1;
    },

    reveal: async (matchId, fromSequence, revealed) => {
      const updated = await prisma.match.updateMany({
        where: { id: matchId, lifecycle: "EVENTS_PUBLISHED", revealedSequence: fromSequence },
        data: { revealedSequence: revealed.sequence, homeScore: revealed.homeScore, awayScore: revealed.awayScore },
      });

      return updated.count === 1;
    },

    voidMatch: async (matchId, actor, reason, at) =>
      prisma.$transaction(async (tx) => {
        // The row lock makes "read the state, then leave it" atomic against a scheduler transition.
        const rows = await tx.$queryRaw<{ lifecycle: string }[]>`
          SELECT lifecycle FROM "match"."matches" WHERE id = ${matchId}::uuid FOR UPDATE`;
        const from = rows[0]?.lifecycle as MatchLifecycle | undefined;

        if (from === undefined || UNVOIDABLE.includes(from)) return undefined;

        await tx.match.update({
          where: { id: matchId },
          data: { lifecycle: "VOIDED", status: LIFECYCLE_STATUS.VOIDED, voidedAt: at, nextAttemptAt: null },
        });

        await tx.matchTransition.create({
          data: { matchId, fromState: from, toState: "VOIDED", at, actor, reason: reason.slice(0, 240) },
        });

        return from;
      }),
  };
}
