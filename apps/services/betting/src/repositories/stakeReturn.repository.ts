import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  PendingStakeReturn,
  StakeReturnDirection,
  StakeReturnRepository,
  WalletMovementType,
  WalletOwnerType,
} from "../interfaces/index.js";

interface StakeReturnRow {
  readonly bet_id: string;
  readonly direction: string;
  readonly owner_type: string;
  readonly owner_id: string;
  readonly amount: bigint;
  readonly movement_type: string;
  readonly reference: string | null;
  readonly actor_id: string | null;
  readonly idempotency_key: string;
  readonly request_id: string;
  readonly attempts: number;
}

function toPending(row: StakeReturnRow): PendingStakeReturn {
  return {
    betId: row.bet_id,
    direction: row.direction as StakeReturnDirection,
    requestId: row.request_id,
    attempts: row.attempts,
    movement: {
      ownerType: row.owner_type as WalletOwnerType,
      ownerId: row.owner_id,
      amount: Number(row.amount),
      type: row.movement_type as WalletMovementType,
      idempotencyKey: row.idempotency_key,
      ...(row.reference === null ? {} : { reference: row.reference }),
      ...(row.actor_id === null ? {} : { actorId: row.actor_id }),
    },
  };
}

export function createStakeReturnRepository(prisma: PrismaClient): StakeReturnRepository {
  return {
    record: async (entry, nextAttemptAt) => {
      const { movement } = entry;

      await prisma.$executeRaw`
        INSERT INTO betting.stake_returns (bet_id, direction, owner_type, owner_id, amount, movement_type,
          reference, actor_id, idempotency_key, request_id, attempts, next_attempt_at)
        VALUES (${entry.betId}::uuid, ${entry.direction}, ${movement.ownerType}, ${movement.ownerId}::uuid,
          ${BigInt(movement.amount)}, ${movement.type}, ${movement.reference ?? null},
          ${movement.actorId ?? null}::uuid, ${movement.idempotencyKey}, ${entry.requestId.slice(0, 200)},
          ${entry.attempts}, ${nextAttemptAt})
        ON CONFLICT (bet_id) DO NOTHING`;
    },

    claimDue: async (now, leaseUntil, limit) => {
      const rows = await prisma.$queryRaw<StakeReturnRow[]>`
        UPDATE betting.stake_returns
        SET next_attempt_at = ${leaseUntil}
        WHERE bet_id IN (
          SELECT bet_id FROM betting.stake_returns
          WHERE resolved_at IS NULL AND next_attempt_at <= ${now}
          ORDER BY next_attempt_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED)
        RETURNING bet_id, direction, owner_type, owner_id, amount, movement_type, reference, actor_id,
          idempotency_key, request_id, attempts`;

      return rows.map(toPending);
    },

    defer: async (betId, error, nextAttemptAt) => {
      await prisma.$executeRaw`
        UPDATE betting.stake_returns
        SET attempts = attempts + 1, last_error = ${error.slice(0, 240)}, next_attempt_at = ${nextAttemptAt}
        WHERE bet_id = ${betId}::uuid AND resolved_at IS NULL`;
    },

    resolve: async (betId, resolution, now) => {
      await prisma.$executeRaw`
        UPDATE betting.stake_returns
        SET resolved_at = ${now}, resolution = ${resolution}, attempts = attempts + 1
        WHERE bet_id = ${betId}::uuid AND resolved_at IS NULL`;
    },
  };
}
