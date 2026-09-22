// Every guard that must not race (spending a code, a step, an attempt, a ticket) is a conditional update whose row count is the answer.

import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type {
  ChannelRepository,
  DeletionRepository,
  KycRepository,
  LimitsRepository,
  PasswordRepository,
  ResponsibleGamingRow,
  SessionListing,
  TwoFactorRepository,
} from "../interfaces/index.js";

type Db = PrismaClient | Prisma.TransactionClient;

const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

const updated = ({ count }: { count: number }): boolean => count === 1;

function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/gu, (character) => `\\${character}`)}%`;
}

export function twoFactor(db: Db): TwoFactorRepository {
  return {
    find: async (customerId) => orUndefined(await db.customerTwoFactor.findUnique({ where: { customerId } })),
    enable: async (customerId, secretCiphertext, step, at) =>
      db.customerTwoFactor.upsert({
        where: { customerId },
        create: { customerId, secretCiphertext, lastStep: BigInt(step), enabledAt: at },
        update: { secretCiphertext, lastStep: BigInt(step), enabledAt: at },
      }),
    remove: async (customerId) => {
      await db.customerTwoFactor.deleteMany({ where: { customerId } });
      await db.backupCode.deleteMany({ where: { customerId } });
    },
    claimStep: async (customerId, step) =>
      updated(
        await db.customerTwoFactor.updateMany({
          where: { customerId, OR: [{ lastStep: null }, { lastStep: { lt: BigInt(step) } }] },
          data: { lastStep: BigInt(step) },
        }),
      ),
    createEnrollment: async (enrollment) => db.twoFactorEnrollment.create({ data: enrollment }),
    findEnrollment: async (id) => orUndefined(await db.twoFactorEnrollment.findUnique({ where: { id } })),
    claimEnrollmentAttempt: async (id, maxAttempts) =>
      updated(
        await db.twoFactorEnrollment.updateMany({
          where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
          data: { attempts: { increment: 1 } },
        }),
      ),
    consumeEnrollment: async (id, at) =>
      updated(await db.twoFactorEnrollment.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: at } })),
    replaceBackupCodes: async (customerId, codeHashes) => {
      await db.backupCode.deleteMany({ where: { customerId } });
      await db.backupCode.createMany({ data: codeHashes.map((codeHash) => ({ customerId, codeHash })) });
    },
    countUnusedBackupCodes: async (customerId) => db.backupCode.count({ where: { customerId, usedAt: null } }),
    consumeBackupCode: async (customerId, codeHash, at) =>
      updated(await db.backupCode.updateMany({ where: { customerId, codeHash, usedAt: null }, data: { usedAt: at } })),
    listBackupCodes: async (customerId) => db.backupCode.findMany({ where: { customerId } }),
    createChallenge: async (challenge) =>
      db.loginChallenge.create({
        data: {
          customerId: challenge.customerId,
          tokenHash: challenge.tokenHash,
          expiresAt: challenge.expiresAt,
          device: challenge.device ?? null,
          browser: challenge.browser ?? null,
          platform: challenge.platform ?? null,
        },
      }),
    findChallenge: async (tokenHash) => orUndefined(await db.loginChallenge.findUnique({ where: { tokenHash } })),
    claimChallengeAttempt: async (id, maxAttempts) =>
      updated(
        await db.loginChallenge.updateMany({
          where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
          data: { attempts: { increment: 1 } },
        }),
      ),
    consumeChallenge: async (id, at) =>
      updated(await db.loginChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: at } })),
    purgeOlderThan: async (before) => {
      const [challenges, enrollments] = await Promise.all([
        db.loginChallenge.deleteMany({ where: { createdAt: { lt: before } } }),
        db.twoFactorEnrollment.deleteMany({ where: { createdAt: { lt: before } } }),
      ]);

      return challenges.count + enrollments.count;
    },
  };
}

export function passwords(db: Db): PasswordRepository {
  return {
    change: async (customer, newHash, at) => {
      await db.passwordHistory.create({ data: { customerId: customer.id, passwordHash: customer.passwordHash, createdAt: at } });
      await db.customer.update({ where: { id: customer.id }, data: { passwordHash: newHash, passwordChangedAt: at } });
    },
    recentHashes: async (customerId, limit) =>
      (
        await db.passwordHistory.findMany({
          where: { customerId },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { passwordHash: true },
        })
      ).map((row) => row.passwordHash),
    replaceReset: async (customerId, id, codeHash, expiresAt) => {
      await db.passwordReset.deleteMany({ where: { customerId } });
      await db.passwordReset.create({ data: { id, customerId, tokenHash: codeHash, expiresAt } });
    },
    findLatestReset: async (customerId) =>
      orUndefined(await db.passwordReset.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" } })),
    claimResetAttempt: async (id, maxAttempts) =>
      updated(
        await db.passwordReset.updateMany({
          where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
          data: { attempts: { increment: 1 } },
        }),
      ),
    consumeReset: async (id, at) =>
      updated(await db.passwordReset.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: at } })),
  };
}

export function deletions(db: Db): DeletionRepository {
  return {
    findLatest: async (customerId) =>
      orUndefined(await db.accountDeletion.findFirst({ where: { customerId }, orderBy: { requestedAt: "desc" } })),
    findByKey: async (customerId, idempotencyKey) =>
      orUndefined(
        await db.accountDeletion.findUnique({ where: { customerId_idempotencyKey: { customerId, idempotencyKey } } }),
      ),
    create: async (deletion) =>
      db.accountDeletion.create({
        data: {
          customerId: deletion.customerId,
          reason: deletion.reason ?? null,
          idempotencyKey: deletion.idempotencyKey,
          scheduledFor: deletion.scheduledFor,
        },
      }),
    cancel: async (id, at) =>
      updated(await db.accountDeletion.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED", cancelledAt: at } })),
    due: async (now, limit) =>
      db.accountDeletion.findMany({
        where: { status: "PENDING", scheduledFor: { lte: now } },
        orderBy: { scheduledFor: "asc" },
        take: limit,
      }),
    complete: async (id, at) =>
      updated(await db.accountDeletion.updateMany({ where: { id, status: "PENDING" }, data: { status: "COMPLETED", completedAt: at } })),
    anonymise: async (customerId, replacement, at) => {
      await db.customer.update({
        where: { id: customerId },
        data: {
          email: replacement.email,
          displayName: replacement.displayName,
          phone: null,
          passwordHash: replacement.passwordHash,
          status: "SUSPENDED",
          deletedAt: at,
        },
      });

      const where = { customerId };

      await Promise.all([
        db.customerTwoFactor.deleteMany({ where }),
        db.twoFactorEnrollment.deleteMany({ where }),
        db.backupCode.deleteMany({ where }),
        db.loginChallenge.deleteMany({ where }),
        db.passwordHistory.deleteMany({ where }),
        db.passwordReset.deleteMany({ where }),
        db.emailVerification.deleteMany({ where }),
        db.notificationPreference.deleteMany({ where }),
        db.pushDevice.deleteMany({ where }),
        db.notification.deleteMany({ where }),
        db.kycUpload.deleteMany({ where }),
      ]);
    },
  };
}

export function channels(db: Db): ChannelRepository {
  return {
    findPreferences: async (customerId) =>
      orUndefined(await db.notificationPreference.findUnique({ where: { customerId } })),
    savePreferences: async (customerId, value, at) => {
      const json = value as Prisma.InputJsonValue;

      await db.notificationPreference.upsert({
        where: { customerId },
        create: { customerId, channels: json, updatedAt: at },
        update: { channels: json, updatedAt: at },
      });
    },
    listDevices: async (customerId) =>
      db.pushDevice.findMany({ where: { customerId }, orderBy: [{ registeredAt: "desc" }, { id: "asc" }] }),
    upsertDevice: async (device, at) =>
      db.pushDevice.upsert({
        where: { tokenHash: device.tokenHash },
        create: { ...device, sessionId: device.sessionId ?? null, registeredAt: at, lastSeenAt: at },
        update: {
          customerId: device.customerId,
          platform: device.platform,
          label: device.label,
          sessionId: device.sessionId ?? null,
          lastSeenAt: at,
        },
      }),
    removeDevice: async (customerId, id) => (await db.pushDevice.deleteMany({ where: { id, customerId } })).count === 1,
    removeByTokenHash: async (tokenHash) => {
      await db.pushDevice.deleteMany({ where: { tokenHash } });
    },
    trimDevices: async (customerId, keep) => {
      const stale = await db.pushDevice.findMany({
        where: { customerId },
        orderBy: [{ registeredAt: "desc" }, { id: "asc" }],
        skip: keep,
        select: { id: true },
      });

      if (stale.length > 0) {
        await db.pushDevice.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
      }
    },
  };
}

export function kyc(db: Db): KycRepository {
  return {
    createUpload: async (upload) => db.kycUpload.create({ data: upload }),
    findUpload: async (customerId, id) => orUndefined(await db.kycUpload.findFirst({ where: { id, customerId } })),
    consumeUpload: async (id, at) =>
      updated(await db.kycUpload.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: at } })),
    countUploadsSince: async (customerId, since) => db.kycUpload.count({ where: { customerId, createdAt: { gte: since } } }),
    createDocument: async (upload, at) =>
      db.kycDocument.create({
        data: {
          customerId: upload.customerId,
          type: upload.type,
          fileName: upload.fileName,
          contentType: upload.contentType,
          sizeBytes: upload.sizeBytes,
          objectKey: upload.objectKey,
          uploadedAt: at,
        },
      }),
    listDocuments: async (customerId) =>
      db.kycDocument.findMany({ where: { customerId }, orderBy: [{ uploadedAt: "desc" }, { id: "asc" }] }),
    findDocument: async (id) => orUndefined(await db.kycDocument.findUnique({ where: { id } })),
    hasPendingOfType: async (customerId, type) =>
      (await db.kycDocument.count({ where: { customerId, type, status: "PENDING" } })) > 0,
    decidePending: async (customerId, status, reason, reviewer, at) =>
      (
        await db.kycDocument.updateMany({
          where: { customerId, status: "PENDING" },
          data: { status, rejectionReason: reason ?? null, reviewedAt: at, reviewedBy: reviewer },
        })
      ).count,
    recordCheck: async (check) =>
      db.kycIdentityCheck.create({
        data: { ...check, providerReference: check.providerReference ?? null, message: check.message ?? null },
      }),
    latestChecks: async (customerId) =>
      db.kycIdentityCheck.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        distinct: ["check"],
      }),
    countChecksSince: async (customerId, since) =>
      db.kycIdentityCheck.count({ where: { customerId, createdAt: { gte: since } } }),
    verifiedElsewhere: async (check, numberHash, customerId) =>
      (await db.kycIdentityCheck.count({ where: { check, numberHash, status: "VERIFIED", customerId: { not: customerId } } })) > 0,
    findProfile: async (customerId) => orUndefined(await db.kycProfile.findUnique({ where: { customerId } })),
    saveProfile: async (customerId, decision, reason, reviewer, at) => {
      const data = { decision, reason: reason ?? null, reviewedAt: at, reviewedBy: reviewer };

      await db.kycProfile.upsert({ where: { customerId }, create: { customerId, ...data }, update: data });
    },
    queue: async (filter) => {
      const where: Prisma.CustomerWhereInput = {
        deletedAt: null,
        kycDocuments: { some: { status: filter.status } },
        ...(filter.search === undefined
          ? {}
          : {
              OR: [
                { email: { contains: filter.search, mode: "insensitive" } },
                { displayName: { contains: filter.search, mode: "insensitive" } },
              ],
            }),
      };

      const [customers, total] = await Promise.all([
        db.customer.findMany({
          where,
          include: { kycDocuments: { orderBy: [{ uploadedAt: "desc" }, { id: "asc" }] } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
        }),
        db.customer.count({ where }),
      ]);

      return {
        items: customers.map(({ kycDocuments, ...customer }) => ({ customer, documents: kycDocuments })),
        total,
      };
    },
    purgeUploadsOlderThan: async (before) =>
      (await db.kycUpload.deleteMany({ where: { createdAt: { lt: before } } })).count,
  };
}

interface FlagRow {
  readonly id: string;
  readonly self_excluded: boolean;
  readonly breach_at: Date | null;
  readonly raised_at: Date | null;
  readonly long_session_at: Date | null;
  readonly total: bigint;
}

export function limits(db: Db): LimitsRepository {
  return {
    list: async (customerId) => db.responsibleGamingLimit.findMany({ where: { customerId }, orderBy: { kind: "asc" } }),
    find: async (customerId, kind) =>
      orUndefined(await db.responsibleGamingLimit.findUnique({ where: { customerId_kind: { customerId, kind } } })),
    set: async (customerId, kind, value, at) => {
      const data = {
        value,
        effectiveAt: at,
        pendingValue: null,
        pendingEffectiveAt: null,
        removalEffectiveAt: null,
        updatedAt: at,
      };

      await db.responsibleGamingLimit.upsert({
        where: { customerId_kind: { customerId, kind } },
        create: { customerId, kind, ...data },
        update: data,
      });
    },
    setPending: async (customerId, kind, pendingValue, effectiveAt, at) => {
      await db.responsibleGamingLimit.update({
        where: { customerId_kind: { customerId, kind } },
        data: { pendingValue, pendingEffectiveAt: effectiveAt, removalEffectiveAt: null, updatedAt: at },
      });
    },
    scheduleRemoval: async (customerId, kind, effectiveAt, at) => {
      await db.responsibleGamingLimit.update({
        where: { customerId_kind: { customerId, kind } },
        data: { removalEffectiveAt: effectiveAt, pendingValue: null, pendingEffectiveAt: null, updatedAt: at },
      });
    },
    settleDue: async (customerId, now) => {
      const scope = customerId ?? null;

      const removed = await db.$executeRaw`
        DELETE FROM identity.rg_limits
        WHERE (${scope}::uuid IS NULL OR customer_id = ${scope}::uuid)
          AND removal_effective_at IS NOT NULL AND removal_effective_at <= ${now}`;

      const raised = await db.$executeRaw`
        UPDATE identity.rg_limits
        SET value = pending_value, effective_at = pending_effective_at,
            pending_value = NULL, pending_effective_at = NULL, updated_at = ${now}
        WHERE (${scope}::uuid IS NULL OR customer_id = ${scope}::uuid)
          AND pending_effective_at IS NOT NULL AND pending_effective_at <= ${now}`;

      return removed + raised;
    },
    appendHistory: async (entry) => {
      await db.limitHistory.create({
        data: {
          customerId: entry.customerId,
          kind: entry.kind,
          action: entry.action,
          previousValue: entry.previousValue ?? null,
          value: entry.value ?? null,
          at: entry.at,
        },
      });
    },
    history: async (customerId, limit) =>
      db.limitHistory.findMany({ where: { customerId }, orderBy: [{ at: "desc" }, { id: "desc" }], take: limit }),
    activeExclusion: async (customerId, now) =>
      orUndefined(
        await db.selfExclusion.findFirst({
          where: { customerId, cancelledAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          orderBy: { startedAt: "desc" },
        }),
      ),
    createExclusion: async (exclusion) =>
      db.selfExclusion.create({
        data: {
          customerId: exclusion.customerId,
          period: exclusion.period,
          startedAt: exclusion.startedAt,
          endsAt: exclusion.endsAt ?? null,
          canCancelAt: exclusion.canCancelAt ?? null,
        },
      }),
    cancelExclusion: async (id, at) =>
      updated(await db.selfExclusion.updateMany({ where: { id, cancelledAt: null }, data: { cancelledAt: at } })),
    recordRefusal: async (customerId, action, code, amount, at) => {
      await db.limitCheckRefusal.create({ data: { customerId, action, code, amount, at } });
    },
    page: async (filter) => {
      const pattern = filter.search === undefined ? null : likePattern(filter.search);
      const flagName = filter.flag ?? null;

      const rows = await db.$queryRaw<FlagRow[]>`
        WITH candidate AS (
          SELECT c.id,
            EXISTS (SELECT 1 FROM identity.rg_self_exclusions e
                    WHERE e.customer_id = c.id AND e.cancelled_at IS NULL
                      AND (e.ends_at IS NULL OR e.ends_at > ${filter.now})) AS self_excluded,
            (SELECT max(r.at) FROM identity.rg_limit_refusals r
              WHERE r.customer_id = c.id AND r.at >= ${filter.lookbackSince}) AS breach_at,
            (SELECT max(h.at) FROM identity.rg_limit_history h
              WHERE h.customer_id = c.id AND h.action IN ('RAISED', 'REMOVED') AND h.at >= ${filter.lookbackSince}) AS raised_at,
            (SELECT min(s.created_at) FROM identity.sessions s
              WHERE s.kind = 'CUSTOMER' AND s.subject_id = c.id AND s.revoked_at IS NULL
                AND s.expires_at > ${filter.now} AND s.created_at <= ${filter.longSessionBefore}
                AND s.last_seen_at >= ${filter.activeSince}) AS long_session_at,
            EXISTS (SELECT 1 FROM identity.rg_limits l WHERE l.customer_id = c.id)
              OR EXISTS (SELECT 1 FROM identity.rg_self_exclusions e2 WHERE e2.customer_id = c.id) AS has_settings,
            c.created_at
          FROM identity.customers c
          WHERE c.deleted_at IS NULL
            AND (${pattern}::text IS NULL OR c.email ILIKE ${pattern} OR c.display_name ILIKE ${pattern})
        )
        SELECT id::text AS id, self_excluded, breach_at, raised_at, long_session_at, count(*) OVER () AS total
        FROM candidate
        WHERE (self_excluded OR breach_at IS NOT NULL OR raised_at IS NOT NULL OR long_session_at IS NOT NULL OR has_settings)
          AND (${flagName}::text IS NULL
            OR (${flagName}::text = 'SELF_EXCLUDED' AND self_excluded)
            OR (${flagName}::text = 'LIMIT_BREACH_ATTEMPT' AND breach_at IS NOT NULL)
            OR (${flagName}::text = 'LIMIT_RAISED' AND raised_at IS NOT NULL)
            OR (${flagName}::text = 'LONG_SESSION' AND long_session_at IS NOT NULL))
        ORDER BY greatest(breach_at, raised_at, long_session_at) DESC NULLS LAST, created_at DESC, id
        LIMIT ${filter.pageSize} OFFSET ${(filter.page - 1) * filter.pageSize}`;

      const customers = await db.customer.findMany({ where: { id: { in: rows.map((row) => row.id) } } });
      const byId = new Map(customers.map((customer) => [customer.id, customer]));

      const items = rows.flatMap((row): ResponsibleGamingRow[] => {
        const customer = byId.get(row.id);

        return customer === undefined
          ? []
          : [
              {
                customer,
                selfExcluded: row.self_excluded,
                breachAt: row.breach_at ?? undefined,
                raisedAt: row.raised_at ?? undefined,
                longSessionAt: row.long_session_at ?? undefined,
              },
            ];
      });

      return { items, total: Number(rows[0]?.total ?? 0n) };
    },
  };
}

export function sessionListing(db: Db): SessionListing {
  return {
    listLive: async (customerId, now) =>
      db.session.findMany({
        where: { kind: "CUSTOMER", subjectId: customerId, revokedAt: null, expiresAt: { gt: now } },
        orderBy: [{ lastSeenAt: "desc" }, { id: "asc" }],
      }),
    findById: async (id) => orUndefined(await db.session.findUnique({ where: { id } })),
    revokeOwned: async (id, customerId, at) =>
      updated(
        await db.session.updateMany({
          where: { id, kind: "CUSTOMER", subjectId: customerId, revokedAt: null, expiresAt: { gt: at } },
          data: { revokedAt: at },
        }),
      ),
    revokeOthers: async (customerId, keepId, at) =>
      (
        await db.session.updateMany({
          where: {
            kind: "CUSTOMER",
            subjectId: customerId,
            revokedAt: null,
            ...(keepId === undefined ? {} : { id: { not: keepId } }),
          },
          data: { revokedAt: at },
        })
      ).count,
    extend: async (id, expiresAt) => {
      await db.session.updateMany({ where: { id, revokedAt: null, expiresAt: { lt: expiresAt } }, data: { expiresAt } });
    },
    newestLive: async (customerId, now) =>
      orUndefined(
        await db.session.findFirst({
          where: { kind: "CUSTOMER", subjectId: customerId, revokedAt: null, expiresAt: { gt: now } },
          orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
        }),
      ),
    seenClient: async (customerId, labels, since) =>
      (await db.session.count({
        where: {
          kind: "CUSTOMER",
          subjectId: customerId,
          createdAt: { gte: since },
          device: labels.device ?? null,
          browser: labels.browser ?? null,
          platform: labels.platform ?? null,
        },
      })) > 0,
    pendingEviction: async (now, limit, target) =>
      db.session.findMany({
        where: {
          revokedAt: { not: null },
          expiresAt: { gt: now },
          ...(target === "cache" ? { cacheEvictedAt: null } : { realtimeRevokedAt: null }),
        },
        select: { id: true, tokenHash: true },
        orderBy: { revokedAt: "asc" },
        take: limit,
      }),
    markEvicted: async (ids, at) => {
      if (ids.length > 0) {
        await db.session.updateMany({ where: { id: { in: [...ids] } }, data: { cacheEvictedAt: at } });
      }
    },
    markRealtimeRevoked: async (ids, at) => {
      if (ids.length > 0) {
        await db.session.updateMany({ where: { id: { in: [...ids] } }, data: { realtimeRevokedAt: at } });
      }
    },
  };
}
