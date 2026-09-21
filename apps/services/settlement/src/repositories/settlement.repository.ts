/**
 * PostgreSQL implementation of {@link SettlementRepository}.
 *
 * Every value reaches SQL as a bound parameter. The admin list joins this schema to `betting`, `match`,
 * `simulation` and `identity` with schema-qualified names; it writes none of them.
 */

import { Prisma } from "../databases/index.js";
import type { PrismaClient } from "../databases/index.js";
import type { MatchSettlementKind } from "../constants/index.js";
import type {
  AdminSettlementFilter,
  SettlementFilter,
  SettlementRepository,
} from "../interfaces/index.js";
import type {
  AdminSettlementRecord,
  AdminSettlementStatus,
  BetChannel,
  MatchSettlementRecord,
  MatchSettlementStatus,
  SettledLegRecord,
  SettlementRecord,
} from "../models/index.js";
import type { BetOutcome, LegOutcome } from "../utils/index.js";
import { lockOrOpenPeriod } from "./period.sql.js";

interface SettlementRow {
  readonly id: string;
  readonly bet_id: string;
  readonly revision: number;
  readonly outcome: string;
  readonly stake: bigint;
  readonly payout: bigint;
  readonly channel: string;
  readonly user_id: string | null;
  readonly shop_id: string | null;
  readonly cashier_id: string | null;
  readonly period_id: string;
  readonly effects_applied_at: Date | null;
  readonly settled_at: Date;
}

interface SelectionRow {
  readonly settlement_id: string;
  readonly selection_id: string;
  readonly match_id: string;
  readonly outcome: string;
  readonly result: string | null;
}

interface MatchSettlementRow {
  readonly match_id: string;
  readonly kind: string;
  readonly status: string;
  readonly bets_total: number;
  readonly bets_settled: number;
  readonly attempts: number;
  readonly failure_reason: string | null;
  readonly started_at: Date;
  readonly completed_at: Date | null;
}

interface AdminRow {
  readonly bet_id: string;
  readonly settlement_id: string | null;
  readonly ticket_code: string | null;
  readonly channel: string;
  readonly owner_name: string | null;
  readonly owner_id: string | null;
  readonly match_label: string;
  readonly result: string;
  readonly stake: bigint;
  readonly payout: bigint;
  readonly status: string;
  readonly error: string | null;
  readonly occurred_at: Date;
  readonly failed_match_ids: readonly string[];
}

/** How far back the admin list looks for completed match settlements; unfinished ones are always listed. */
const ADMIN_WINDOW_HOURS = 48;

const SETTLEMENT_COLUMNS = Prisma.sql`
  s.id, s.bet_id, s.revision, s.outcome, s.stake, s.payout, s.channel, s.user_id, s.shop_id, s.cashier_id,
  s.period_id, s.effects_applied_at, s.settled_at`;

const MATCH_SETTLEMENT_COLUMNS = Prisma.sql`
  match_id, kind, status, bets_total, bets_settled, attempts, failure_reason, started_at, completed_at`;

function toMatchSettlement(row: MatchSettlementRow): MatchSettlementRecord {
  return {
    matchId: row.match_id,
    kind: row.kind as MatchSettlementKind,
    status: row.status as MatchSettlementStatus,
    betsTotal: row.bets_total,
    betsSettled: row.bets_settled,
    attempts: row.attempts,
    failureReason: row.failure_reason,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function toSettlement(row: SettlementRow, legs: readonly SettledLegRecord[]): SettlementRecord {
  return {
    id: row.id,
    betId: row.bet_id,
    revision: row.revision,
    outcome: row.outcome as BetOutcome,
    stake: row.stake,
    payout: row.payout,
    channel: row.channel as BetChannel,
    userId: row.user_id,
    shopId: row.shop_id,
    cashierId: row.cashier_id,
    periodId: row.period_id,
    effectsAppliedAt: row.effects_applied_at,
    settledAt: row.settled_at,
    legs,
  };
}

function toAdmin(row: AdminRow): AdminSettlementRecord {
  return {
    betId: row.bet_id,
    settlementId: row.settlement_id,
    ticketCode: row.ticket_code,
    channel: row.channel as BetChannel,
    ownerName: row.owner_name,
    ownerId: row.owner_id,
    matchLabel: row.match_label,
    result: row.result,
    stake: row.stake,
    payout: row.payout,
    status: row.status as AdminSettlementStatus,
    error: row.error,
    timestamp: row.occurred_at,
    failedMatchIds: row.failed_match_ids,
  };
}

export function createSettlementRepository(prisma: PrismaClient): SettlementRepository {
  const hydrate = async (rows: readonly SettlementRow[]): Promise<SettlementRecord[]> => {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);

    const selections = await prisma.$queryRaw<SelectionRow[]>`
      SELECT settlement_id, selection_id, match_id, outcome, result
      FROM settlement.settled_selections
      WHERE settlement_id = ANY(${ids}::uuid[])
      ORDER BY settlement_id, id`;

    const bySettlement = new Map<string, SettledLegRecord[]>();

    for (const selection of selections) {
      const legs = bySettlement.get(selection.settlement_id) ?? [];

      legs.push({
        selectionId: selection.selection_id,
        matchId: selection.match_id,
        outcome: selection.outcome as LegOutcome,
        result: selection.result,
      });
      bySettlement.set(selection.settlement_id, legs);
    }

    return rows.map((row) => toSettlement(row, bySettlement.get(row.id) ?? []));
  };

  const findByBetIds: SettlementRepository["findByBetIds"] = async (betIds) => {
    if (betIds.length === 0) {
      return [];
    }

    const rows = await prisma.$queryRaw<SettlementRow[]>`
      SELECT ${SETTLEMENT_COLUMNS}
      FROM settlement.settlements s
      WHERE s.bet_id = ANY(${[...betIds]}::uuid[]) AND s.revision = 1`;

    return hydrate(rows);
  };

  /**
   * One row per bet that has a leg on a match settlement has been asked to settle. `scope` narrows the bets;
   * the status is derived, never stored: stamped → COMPLETED/VOIDED, a FAILED match among the legs → FAILED,
   * anything else is still PENDING. A leg's score is shown only once its match is COMPLETED.
   */
  const adminRows = async (
    scope: Prisma.Sql,
    status: AdminSettlementStatus | undefined,
    limit: number,
  ): Promise<AdminSettlementRecord[]> => {
    const rows = await prisma.$queryRaw<AdminRow[]>`
      WITH scoped AS (${scope}),
      legs AS (
        SELECT bs.bet_id,
               string_agg(bs.match_label, ' + ' ORDER BY bs.kickoff_at, bs.id) AS match_label,
               string_agg(
                 CASE
                   WHEN ms.kind = 'VOID' OR m.lifecycle::text = 'VOIDED' OR m.status::text = 'CANCELLED' THEN 'VOID'
                   WHEN m.status::text = 'COMPLETED' AND r.match_id IS NOT NULL
                     THEN r.home_goals::text || '-' || r.away_goals::text
                   ELSE '-'
                 END, ', ' ORDER BY bs.kickoff_at, bs.id) AS result,
               COALESCE(array_agg(DISTINCT bs.match_id::text) FILTER (WHERE ms.status = 'FAILED'), '{}') AS failed_match_ids,
               MAX(ms.failure_reason) FILTER (WHERE ms.status = 'FAILED') AS failure_reason,
               MAX(ms.started_at) AS started_at
        FROM scoped sc
        JOIN betting.bet_selections bs ON bs.bet_id = sc.bet_id
        LEFT JOIN match.matches m ON m.id = bs.match_id
        LEFT JOIN simulation.match_results r ON r.match_id = bs.match_id
        LEFT JOIN settlement.match_settlements ms ON ms.match_id = bs.match_id
        GROUP BY bs.bet_id
      ),
      listed AS (
        SELECT b.id AS bet_id,
               s.id AS settlement_id,
               t.code AS ticket_code,
               b.channel::text AS channel,
               CASE WHEN b.channel::text = 'SHOP' THEN sh.code ELSE c.display_name END AS owner_name,
               CASE WHEN b.channel::text = 'SHOP' THEN b.shop_id::text ELSE b.user_id::text END AS owner_id,
               l.match_label,
               l.result,
               b.stake::bigint AS stake,
               COALESCE(s.payout, 0)::bigint AS payout,
               CASE
                 WHEN s.effects_applied_at IS NOT NULL AND s.outcome = 'VOID' THEN 'VOIDED'
                 WHEN s.effects_applied_at IS NOT NULL THEN 'COMPLETED'
                 WHEN cardinality(l.failed_match_ids) > 0 THEN 'FAILED'
                 ELSE 'PENDING'
               END AS status,
               CASE WHEN s.effects_applied_at IS NULL THEN l.failure_reason END AS error,
               COALESCE(s.effects_applied_at, s.settled_at, l.started_at) AS occurred_at,
               l.failed_match_ids
        FROM legs l
        JOIN betting.bets b ON b.id = l.bet_id
        LEFT JOIN settlement.settlements s ON s.bet_id = b.id AND s.revision = 1
        LEFT JOIN betting.tickets t ON t.bet_id = b.id
        LEFT JOIN identity.customers c ON c.id = b.user_id
        LEFT JOIN identity.shops sh ON sh.id = b.shop_id
        WHERE b.status::text <> 'CANCELLED'
      )
      SELECT * FROM listed
      WHERE ${status === undefined ? Prisma.sql`TRUE` : Prisma.sql`status = ${status}`}
      ORDER BY occurred_at DESC, bet_id
      LIMIT ${limit}`;

    return rows.map(toAdmin);
  };

  return {
    beginMatchSettlement: async (matchId, kind) => {
      // Once a match has been voided its settlement stays a void, whatever a later caller asks for.
      const started = await prisma.$queryRaw<MatchSettlementRow[]>`
        INSERT INTO settlement.match_settlements AS ms (match_id, kind, status, attempts)
        VALUES (${matchId}::uuid, ${kind}, 'STARTED', 1)
        ON CONFLICT (match_id) DO UPDATE
          SET status = 'STARTED',
              attempts = ms.attempts + 1,
              failure_reason = NULL,
              kind = CASE WHEN ms.kind = 'VOID' THEN 'VOID' ELSE EXCLUDED.kind END
          WHERE ms.status <> 'COMPLETED'
        RETURNING ${MATCH_SETTLEMENT_COLUMNS}`;

      const row = started[0];

      if (row !== undefined) {
        return { started: true, record: toMatchSettlement(row) };
      }

      const existing = await prisma.$queryRaw<MatchSettlementRow[]>`
        SELECT ${MATCH_SETTLEMENT_COLUMNS}
        FROM settlement.match_settlements WHERE match_id = ${matchId}::uuid`;

      const completed = existing[0];

      if (completed === undefined) {
        throw new Error("The match settlement could be neither started nor read.");
      }

      return { started: false, record: toMatchSettlement(completed) };
    },

    finishMatchSettlement: async (input) => {
      const rows = await prisma.$queryRaw<MatchSettlementRow[]>`
        UPDATE settlement.match_settlements
        SET status = ${input.status},
            bets_total = ${input.betsTotal},
            bets_settled = ${input.betsSettled},
            failure_reason = ${input.failureReason},
            completed_at = CASE WHEN ${input.status} = 'COMPLETED' THEN now() ELSE NULL END
        WHERE match_id = ${input.matchId}::uuid AND status <> 'COMPLETED'
        RETURNING ${MATCH_SETTLEMENT_COLUMNS}`;

      const row = rows[0];

      if (row !== undefined) {
        return toMatchSettlement(row);
      }

      const existing = await prisma.$queryRaw<MatchSettlementRow[]>`
        SELECT ${MATCH_SETTLEMENT_COLUMNS}
        FROM settlement.match_settlements WHERE match_id = ${input.matchId}::uuid`;

      const current = existing[0];

      if (current === undefined) {
        throw new Error("The match settlement does not exist.");
      }

      return toMatchSettlement(current);
    },

    findMatchSettlement: async (matchId) => {
      const rows = await prisma.$queryRaw<MatchSettlementRow[]>`
        SELECT ${MATCH_SETTLEMENT_COLUMNS}
        FROM settlement.match_settlements WHERE match_id = ${matchId}::uuid`;

      const row = rows[0];

      return row === undefined ? undefined : toMatchSettlement(row);
    },

    recordSettlement: async (settlement) => {
      const created = await prisma.$transaction(async (tx) => {
        const period = await lockOrOpenPeriod(tx, new Date());

        const inserted = await tx.$queryRaw<SettlementRow[]>`
          INSERT INTO settlement.settlements AS s
            (bet_id, revision, outcome, stake, payout, channel, user_id, shop_id, cashier_id, period_id)
          VALUES
            (${settlement.betId}::uuid, 1, ${settlement.outcome}, ${settlement.stake}, ${settlement.payout},
             ${settlement.channel}, ${settlement.userId}::uuid, ${settlement.shopId}::uuid,
             ${settlement.cashierId}::uuid, ${period.id})
          ON CONFLICT (bet_id, revision) DO NOTHING
          RETURNING ${SETTLEMENT_COLUMNS}`;

        const row = inserted[0];

        // Nothing inserted: the bet already has its settlement. Writing anything more would be a second payout.
        if (row === undefined) {
          return undefined;
        }

        const legs = settlement.legs.map(
          (leg) =>
            Prisma.sql`(${row.id}::uuid, ${leg.selectionId}::uuid, ${leg.matchId}::uuid, ${leg.outcome}, ${leg.result})`,
        );

        await tx.$executeRaw`
          INSERT INTO settlement.settled_selections (settlement_id, selection_id, match_id, outcome, result)
          VALUES ${Prisma.join(legs)}`;

        await tx.$executeRaw`
          INSERT INTO settlement.operator_ledger_entries
            (settlement_id, period_id, bet_id, channel, user_id, shop_id, cashier_id, outcome, stake, payout)
          VALUES
            (${row.id}::uuid, ${period.id}, ${settlement.betId}::uuid, ${settlement.channel},
             ${settlement.userId}::uuid, ${settlement.shopId}::uuid, ${settlement.cashierId}::uuid,
             ${settlement.outcome}, ${settlement.stake}, ${settlement.payout})`;

        return toSettlement(row, settlement.legs);
      });

      if (created !== undefined) {
        return { created: true, record: created };
      }

      const existing = (await findByBetIds([settlement.betId]))[0];

      if (existing === undefined) {
        throw new Error("The settlement was reported as existing but could not be read.");
      }

      return { created: false, record: existing };
    },

    stampEffects: async (settlementId) => {
      const updated = await prisma.$executeRaw`
        UPDATE settlement.settlements SET effects_applied_at = now()
        WHERE id = ${settlementId}::uuid AND effects_applied_at IS NULL`;

      return updated > 0;
    },

    findByBetIds,

    listUnstamped: async (limit) => {
      const rows = await prisma.$queryRaw<SettlementRow[]>`
        SELECT ${SETTLEMENT_COLUMNS}
        FROM settlement.settlements s
        WHERE s.effects_applied_at IS NULL
        ORDER BY s.settled_at
        LIMIT ${limit}`;

      return hydrate(rows);
    },

    findByBet: async (betId, userId) => {
      const rows = await prisma.$queryRaw<SettlementRow[]>`
        SELECT ${SETTLEMENT_COLUMNS}
        FROM settlement.settlements s
        WHERE s.bet_id = ${betId}::uuid
          AND ${userId === undefined ? Prisma.sql`TRUE` : Prisma.sql`s.user_id = ${userId}::uuid`}
        ORDER BY s.revision DESC
        LIMIT 1`;

      return (await hydrate(rows))[0];
    },

    list: async (filter: SettlementFilter) => {
      const conditions: Prisma.Sql[] = [
        Prisma.sql`NOT EXISTS (
          SELECT 1 FROM settlement.settlements newer
          WHERE newer.bet_id = s.bet_id AND newer.revision > s.revision)`,
      ];

      if (filter.userId !== undefined) {
        conditions.push(Prisma.sql`s.user_id = ${filter.userId}::uuid`);
      }

      if (filter.outcome !== undefined) {
        conditions.push(Prisma.sql`s.outcome = ${filter.outcome}`);
      }

      if (filter.matchId !== undefined) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM settlement.settled_selections ss
          WHERE ss.settlement_id = s.id AND ss.match_id = ${filter.matchId}::uuid)`);
      }

      const rows = await prisma.$queryRaw<SettlementRow[]>`
        SELECT ${SETTLEMENT_COLUMNS}
        FROM settlement.settlements s
        WHERE ${Prisma.join(conditions, " AND ")}
        ORDER BY s.settled_at DESC, s.id
        LIMIT ${filter.limit}`;

      return hydrate(rows);
    },

    listAdmin: async (filter: AdminSettlementFilter) =>
      adminRows(
        Prisma.sql`
          SELECT DISTINCT bs.bet_id
          FROM settlement.match_settlements ms
          JOIN betting.bet_selections bs ON bs.match_id = ms.match_id
          WHERE ms.status <> 'COMPLETED'
             OR ms.started_at > now() - make_interval(hours => ${ADMIN_WINDOW_HOURS})`,
        filter.status,
        filter.limit,
      ),

    findAdminByBet: async (betId) =>
      (
        await adminRows(
          Prisma.sql`SELECT b.id AS bet_id FROM betting.bets b WHERE b.id = ${betId}::uuid`,
          undefined,
          1,
        )
      )[0],
  };
}
