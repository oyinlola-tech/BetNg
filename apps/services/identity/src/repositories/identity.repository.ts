/**
 * Prisma-backed repositories for the `identity` schema.
 *
 * Every repository is built over a `Db`, which is either the client or a
 * transaction, so the same code runs inside and outside `transaction`. Guards
 * that must not race (spending a code, claiming a TOTP step, versioned
 * settings) are conditional updates whose row count is the answer.
 */

import type { PlatformSettings } from "@betng/contracts";
import { SETTINGS_ROW_ID } from "../constants/index.js";
import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  AdminUserRepository,
  AuditLogRepository,
  CashierRepository,
  CustomerRepository,
  IdentityRepositories,
  IdentityStore,
  PasswordResetRepository,
  SessionRepository,
  SettingsRepository,
  ShopRepository,
  ThrottleRepository,
  VerificationRepository,
} from "../interfaces/index.js";

type Db = PrismaClient | Prisma.TransactionClient;

const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

const contains = (needle: string): { contains: string; mode: "insensitive" } => ({
  contains: needle,
  mode: "insensitive",
});

function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined || value === null ? Prisma.DbNull : value;
}

function customers(db: Db): CustomerRepository {
  return {
    findByEmail: async (email) => orUndefined(await db.customer.findUnique({ where: { email } })),
    findById: async (id) => orUndefined(await db.customer.findUnique({ where: { id } })),
    create: async (customer) =>
      db.customer.create({
        data: {
          email: customer.email,
          displayName: customer.displayName,
          phone: customer.phone ?? null,
          passwordHash: customer.passwordHash,
          emailVerifiedAt: customer.emailVerifiedAt ?? null,
        },
      }),
    remove: async (id) => {
      await db.customer.delete({ where: { id } });
    },
    markVerified: async (id, at) =>
      db.customer.update({ where: { id }, data: { emailVerifiedAt: at, lastActiveAt: at } }),
    setStatus: async (id, status) => db.customer.update({ where: { id }, data: { status } }),
    touchActive: async (id, at, olderThan) => {
      await db.customer.updateMany({
        where: { id, lastActiveAt: { lt: olderThan } },
        data: { lastActiveAt: at },
      });
    },
    search: async (q, limit) =>
      db.customer.findMany({
        ...(q === undefined
          ? {}
          : { where: { OR: [{ email: contains(q) }, { displayName: contains(q) }, { phone: contains(q) }] } }),
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: limit,
      }),
  };
}

function verifications(db: Db): VerificationRepository {
  return {
    create: async (verification) => db.emailVerification.create({ data: verification }),
    findLatest: async (customerId) =>
      orUndefined(
        await db.emailVerification.findFirst({
          where: { customerId },
          orderBy: { createdAt: "desc" },
        }),
      ),
    claimAttempt: async (id, maxAttempts) => {
      const { count } = await db.emailVerification.updateMany({
        where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
        data: { attempts: { increment: 1 } },
      });

      return count === 1;
    },
    consume: async (id, at) => {
      const { count } = await db.emailVerification.updateMany({
        where: { id, consumedAt: null },
        data: { consumedAt: at },
      });

      return count === 1;
    },
    invalidateOutstanding: async (customerId, at) => {
      await db.emailVerification.updateMany({
        where: { customerId, consumedAt: null },
        data: { consumedAt: at },
      });
    },
    purgeOlderThan: async (before) =>
      (await db.emailVerification.deleteMany({ where: { createdAt: { lt: before } } })).count,
  };
}

function passwordResets(db: Db): PasswordResetRepository {
  return {
    replace: async (customerId, tokenHash, expiresAt) => {
      await db.passwordReset.deleteMany({ where: { customerId } });
      await db.passwordReset.create({ data: { customerId, tokenHash, expiresAt } });
    },
    purgeOlderThan: async (before) =>
      (await db.passwordReset.deleteMany({ where: { createdAt: { lt: before } } })).count,
  };
}

function admins(db: Db): AdminUserRepository {
  return {
    count: async () => db.adminUser.count(),
    findByEmail: async (email) => orUndefined(await db.adminUser.findUnique({ where: { email } })),
    findById: async (id) => orUndefined(await db.adminUser.findUnique({ where: { id } })),
    create: async (admin) =>
      db.adminUser.create({
        data: {
          email: admin.email,
          name: admin.name,
          role: admin.role,
          passwordHash: admin.passwordHash,
          totpSecret: admin.totpSecret ?? null,
          twoFactorEnabled: admin.totpSecret !== undefined,
        },
      }),
    recordLogin: async (id, at) => db.adminUser.update({ where: { id }, data: { lastLoginAt: at } }),
    claimTotpStep: async (id, step) => {
      const { count } = await db.adminUser.updateMany({
        where: { id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: BigInt(step) } }] },
        data: { totpLastStep: BigInt(step) },
      });

      return count === 1;
    },
  };
}

function shops(db: Db): ShopRepository {
  return {
    findByCode: async (code) => orUndefined(await db.shop.findUnique({ where: { code } })),
    findById: async (id) => orUndefined(await db.shop.findUnique({ where: { id } })),
    list: async (limit) => db.shop.findMany({ orderBy: [{ code: "asc" }], take: limit }),
    create: async (shop) => db.shop.create({ data: shop }),
    update: async (id, changes) => db.shop.update({ where: { id }, data: changes }),
    setStatus: async (id, status) => db.shop.update({ where: { id }, data: { status } }),
  };
}

function cashiers(db: Db): CashierRepository {
  return {
    findByShopAndUsername: async (shopId, username) =>
      orUndefined(await db.cashier.findUnique({ where: { shopId_username: { shopId, username } } })),
    findById: async (id) => orUndefined(await db.cashier.findUnique({ where: { id } })),
    listByShop: async (shopId, limit) =>
      db.cashier.findMany({
        where: { shopId },
        orderBy: [{ createdAt: "asc" }, { username: "asc" }],
        take: limit,
      }),
    activityByShop: async (shopIds) => {
      if (shopIds.length === 0) {
        return [];
      }

      const groups = await db.cashier.groupBy({
        by: ["shopId"],
        where: { shopId: { in: [...shopIds] } },
        _count: { _all: true },
        _max: { lastActiveAt: true },
      });

      return groups.map((group) => ({
        shopId: group.shopId,
        cashierCount: group._count._all,
        lastActiveAt: group._max.lastActiveAt ?? undefined,
      }));
    },
    create: async (cashier) =>
      db.cashier.create({
        data: { ...cashier, credentialsExpireAt: cashier.credentialsExpireAt ?? null },
      }),
    setStatus: async (id, status) => db.cashier.update({ where: { id }, data: { status } }),
    setCredentials: async (id, passwordHash, pinHash, expireAt) =>
      db.cashier.update({
        where: { id },
        data: { passwordHash, pinHash, credentialsExpireAt: expireAt },
      }),
    markCredentialsUsed: async (id) => {
      await db.cashier.updateMany({
        where: { id, credentialsExpireAt: { not: null } },
        data: { credentialsExpireAt: null },
      });
    },
    touchActive: async (id, at, olderThan) => {
      await db.cashier.updateMany({
        where: { id, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: olderThan } }] },
        data: { lastActiveAt: at },
      });
    },
  };
}

function sessions(db: Db): SessionRepository {
  return {
    create: async (session) => db.session.create({ data: session }),
    findByTokenHash: async (tokenHash) =>
      orUndefined(await db.session.findUnique({ where: { tokenHash } })),
    revokeByTokenHash: async (tokenHash, kind, at) => {
      const { count } = await db.session.updateMany({
        where: { tokenHash, kind, revokedAt: null, expiresAt: { gt: at } },
        data: { revokedAt: at },
      });

      return count === 1
        ? orUndefined(await db.session.findUnique({ where: { tokenHash } }))
        : undefined;
    },
    revokeForSubjects: async (kind, subjectIds, at) =>
      subjectIds.length === 0
        ? 0
        : (
            await db.session.updateMany({
              where: { kind, subjectId: { in: [...subjectIds] }, revokedAt: null },
              data: { revokedAt: at },
            })
          ).count,
    touch: async (id, at, olderThan) => {
      await db.session.updateMany({
        where: { id, lastSeenAt: { lt: olderThan } },
        data: { lastSeenAt: at },
      });
    },
    purgeExpiredBefore: async (before) =>
      (await db.session.deleteMany({ where: { expiresAt: { lt: before } } })).count,
  };
}

function throttles(db: Db): ThrottleRepository {
  return {
    find: async (keyHash) => orUndefined(await db.loginThrottle.findUnique({ where: { keyHash } })),
    recordFailure: async (keyHash, maxFailures, lockUntil, at) => {
      const row = await db.loginThrottle.upsert({
        where: { keyHash },
        create: { keyHash, failures: 1, updatedAt: at },
        update: { failures: { increment: 1 }, updatedAt: at },
      });

      if (row.failures >= maxFailures) {
        await db.loginThrottle.update({
          where: { keyHash },
          data: { failures: 0, lockedUntil: lockUntil, updatedAt: at },
        });
      }
    },
    clear: async (keyHash) => {
      await db.loginThrottle.deleteMany({ where: { keyHash } });
    },
    purgeOlderThan: async (before) =>
      (await db.loginThrottle.deleteMany({ where: { updatedAt: { lt: before } } })).count,
  };
}

function audit(db: Db): AuditLogRepository {
  return {
    append: async (entry) =>
      db.auditLog.create({
        data: {
          actorId: entry.actorId,
          actorRole: entry.actorRole,
          actorName: entry.actorName,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: jsonOrNull(entry.before),
          after: jsonOrNull(entry.after),
          reason: entry.reason ?? null,
          severity: entry.severity,
          requestId: entry.requestId,
        },
      }),
    page: async (filter) => {
      const where: Prisma.AuditLogWhereInput = {
        AND: [
          filter.actor === undefined
            ? {}
            : { OR: [{ actorId: contains(filter.actor) }, { actorName: contains(filter.actor) }] },
          filter.action === undefined ? {} : { action: contains(filter.action) },
          filter.resource === undefined
            ? {}
            : { OR: [{ entityType: contains(filter.resource) }, { entityId: contains(filter.resource) }] },
          filter.severity === undefined ? {} : { severity: filter.severity },
          filter.from === undefined ? {} : { createdAt: { gte: filter.from } },
          filter.to === undefined ? {} : { createdAt: { lte: filter.to } },
        ],
      };

      const [items, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (filter.page - 1) * filter.pageSize,
          take: filter.pageSize,
        }),
        db.auditLog.count({ where }),
      ]);

      return { items, total };
    },
  };
}

function settings(db: Db): SettingsRepository {
  return {
    find: async () => {
      const row = await db.platformSettings.findUnique({ where: { id: SETTINGS_ROW_ID } });

      return row === null
        ? undefined
        : { value: row.value as unknown as PlatformSettings, version: row.version };
    },
    createIfMissing: async (value, updatedBy) => {
      await db.platformSettings.createMany({
        data: [{ id: SETTINGS_ROW_ID, value: { ...value }, updatedBy }],
        skipDuplicates: true,
      });
    },
    replace: async (expectedVersion, value, updatedBy, at) => {
      const { count } = await db.platformSettings.updateMany({
        where: { id: SETTINGS_ROW_ID, version: expectedVersion },
        data: { value: { ...value }, version: { increment: 1 }, updatedBy, updatedAt: at },
      });

      return count === 1;
    },
  };
}

function bind(db: Db): IdentityRepositories {
  return {
    customers: customers(db),
    verifications: verifications(db),
    passwordResets: passwordResets(db),
    admins: admins(db),
    shops: shops(db),
    cashiers: cashiers(db),
    sessions: sessions(db),
    throttles: throttles(db),
    audit: audit(db),
    settings: settings(db),
  };
}

export function createIdentityStore(prisma: PrismaClient): IdentityStore {
  return {
    ...bind(prisma),
    transaction: async (work) => prisma.$transaction(async (tx) => work(bind(tx))),
  };
}
