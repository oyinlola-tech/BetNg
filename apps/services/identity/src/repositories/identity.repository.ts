// Guards that must not race (spending a code, claiming a TOTP step, versioned settings) are conditional updates whose row count is the answer.

import type { PlatformSettings } from "@betng/contracts";
import { SETTINGS_ROW_ID } from "../constants/index.js";
import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient, ShopApplicationStatus } from "../generated/prisma/client.js";
import type {
  AdminUserRepository,
  AuditLogRepository,
  CashierRepository,
  CustomerRepository,
  IdentityRepositories,
  IdentityStore,
  NotificationRepository,
  PasswordResetRepository,
  SessionRepository,
  SettingsRepository,
  ShopApplicationRepository,
  ShopApplicationVerificationRepository,
  ShopRepository,
  ThrottleRepository,
  VerificationRepository,
} from "../interfaces/index.js";
import { channels, deletions, kyc, limits, passwords, sessionListing, twoFactor } from "./account.repository.js";

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
    updateProfile: async (id, changes) => db.customer.update({ where: { id }, data: { ...changes } }),
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
    purgeOlderThan: async (before) =>
      (await db.passwordReset.deleteMany({ where: { createdAt: { lt: before } } })).count,
  };
}

function admins(db: Db): AdminUserRepository {
  return {
    count: async () => db.adminUser.count(),
    countSuperAdmins: async () => db.adminUser.count({ where: { role: "SUPER_ADMIN" } }),
    list: async (limit) => db.adminUser.findMany({ orderBy: [{ createdAt: "desc" }], take: limit }),
    countOtherActiveSuperAdmins: async (excludingId) =>
      db.adminUser.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: excludingId } } }),
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
          mustChangePassword: admin.mustChangePassword ?? false,
          credentialsExpireAt: admin.credentialsExpireAt ?? null,
          isBootstrap: admin.isBootstrap ?? false,
        },
      }),
    update: async (id, changes) =>
      db.adminUser.update({
        where: { id },
        data: {
          ...(changes.name === undefined ? {} : { name: changes.name }),
          ...(changes.role === undefined ? {} : { role: changes.role }),
          ...(changes.status === undefined ? {} : { status: changes.status }),
        },
      }),
    setPassword: async (id, passwordHash) =>
      db.adminUser.update({
        where: { id },
        data: { passwordHash, mustChangePassword: false, credentialsExpireAt: null },
      }),
    resetCredentials: async (id, passwordHash, expiresAt) =>
      db.adminUser.update({
        where: { id },
        data: {
          passwordHash,
          totpSecret: null,
          twoFactorEnabled: false,
          totpLastStep: null,
          mustChangePassword: true,
          credentialsExpireAt: expiresAt,
        },
      }),
    recordLogin: async (id, at) => db.adminUser.update({ where: { id }, data: { lastLoginAt: at } }),
    enrolTotp: async (id, sealedSecret) =>
      db.adminUser.update({ where: { id }, data: { totpSecret: sealedSecret, twoFactorEnabled: true, totpLastStep: null } }),
    stagePendingTotp: async (id, sealedSecret) =>
      db.adminUser.update({ where: { id }, data: { totpSecret: sealedSecret, twoFactorEnabled: false, totpLastStep: null } }),
    completeActivation: async (id, passwordHash) =>
      db.adminUser.update({
        where: { id },
        data: { passwordHash, twoFactorEnabled: true, mustChangePassword: false, credentialsExpireAt: null },
      }),
    claimTotpStep: async (id, step) => {
      const { count } = await db.adminUser.updateMany({
        where: { id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: BigInt(step) } }] },
        data: { totpLastStep: BigInt(step) },
      });

      return count === 1;
    },
  };
}

function shopApplications(db: Db): ShopApplicationRepository {
  const OPEN: readonly ShopApplicationStatus[] = ["PENDING", "REQUIRES_ACTION"];

  return {
    findByReference: async (reference) =>
      orUndefined(await db.shopApplication.findUnique({ where: { reference } })),
    findById: async (id) => orUndefined(await db.shopApplication.findUnique({ where: { id } })),
    findLive: async (applicantEmail) =>
      orUndefined(
        await db.shopApplication.findFirst({
          where: { applicantEmail, status: { in: ["PENDING", "REQUIRES_ACTION", "APPROVED"] } },
          orderBy: { createdAt: "desc" },
        }),
      ),
    list: async (status, limit) =>
      db.shopApplication.findMany({
        ...(status === undefined ? {} : { where: { status } }),
        orderBy: [{ createdAt: "desc" }],
        take: limit,
      }),
    create: async (application) =>
      db.shopApplication.create({
        data: {
          reference: application.reference,
          applicantName: application.applicantName,
          applicantEmail: application.applicantEmail,
          applicantPhone: application.applicantPhone,
          businessName: application.businessName,
          rcNumber: application.rcNumber ?? null,
          address: application.address,
          city: application.city,
          state: application.state,
          proposedShopName: application.proposedShopName,
          note: application.note ?? null,
        },
      }),
    markEmailVerified: async (id, at) => {
      await db.shopApplication.update({ where: { id }, data: { emailVerifiedAt: at } });
    },
    decideIfOpen: async (id, decision) => {
      // Conditional on the application still being open, so two reviewers cannot both decide it.
      const { count } = await db.shopApplication.updateMany({
        where: { id, status: { in: [...OPEN] } },
        data: {
          status: decision.status,
          reason: decision.reason,
          decidedBy: decision.decidedBy,
          decidedAt: decision.decidedAt,
          ...(decision.shopId === undefined ? {} : { shopId: decision.shopId }),
        },
      });

      return count === 1;
    },
    listDocuments: async (applicationId) =>
      db.shopApplicationDocument.findMany({ where: { applicationId }, orderBy: { uploadedAt: "asc" } }),
    addDocument: async (document) => db.shopApplicationDocument.create({ data: { ...document } }),
  };
}

function shopApplicationVerifications(db: Db): ShopApplicationVerificationRepository {
  return {
    invalidateOutstanding: async (applicationId, at) => {
      await db.shopApplicationVerification.updateMany({
        where: { applicationId, consumedAt: null },
        data: { consumedAt: at },
      });
    },
    create: async (verification) => {
      await db.shopApplicationVerification.create({ data: { ...verification } });
    },
    findLatest: async (applicationId) =>
      orUndefined(
        await db.shopApplicationVerification.findFirst({ where: { applicationId }, orderBy: { createdAt: "desc" } }),
      ),
    claimAttempt: async (id, maxAttempts) => {
      const { count } = await db.shopApplicationVerification.updateMany({
        where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
        data: { attempts: { increment: 1 } },
      });

      return count === 1
        ? orUndefined(await db.shopApplicationVerification.findUnique({ where: { id } }))
        : undefined;
    },
    consume: async (id, at) => {
      await db.shopApplicationVerification.update({ where: { id }, data: { consumedAt: at } });
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
    ...sessionListing(db),
    create: async (session) =>
      db.session.create({
        data: {
          kind: session.kind,
          subjectId: session.subjectId,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
          device: session.device ?? null,
          browser: session.browser ?? null,
          platform: session.platform ?? null,
        },
      }),
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

function notifications(db: Db): NotificationRepository {
  return {
    createOnce: async (notification) => {
      const { customerId, dedupeKey } = notification;

      // ON CONFLICT DO NOTHING: concurrent retries with one key cannot both insert.
      const [created] = await db.notification.createManyAndReturn({
        data: [
          {
            customerId,
            kind: notification.kind,
            title: notification.title,
            body: notification.body,
            data: jsonOrNull(notification.data),
            dedupeKey: dedupeKey ?? null,
          },
        ],
        skipDuplicates: true,
      });

      if (created !== undefined) {
        return { notification: created, duplicate: false };
      }

      if (dedupeKey === undefined) {
        throw new Error("A notification without a dedupe key was not inserted.");
      }

      return {
        notification: await db.notification.findUniqueOrThrow({
          where: { customerId_dedupeKey: { customerId, dedupeKey } },
        }),
        duplicate: true,
      };
    },
    listForCustomer: async (customerId, limit) =>
      db.notification.findMany({
        where: { customerId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
    markRead: async (customerId, ids, at) =>
      (
        await db.notification.updateMany({
          where: { customerId, readAt: null, ...(ids === undefined ? {} : { id: { in: [...ids] } }) },
          data: { readAt: at },
        })
      ).count,
    purgeOlderThan: async (before) =>
      (await db.notification.deleteMany({ where: { createdAt: { lt: before } } })).count,
  };
}

function bind(db: Db): IdentityRepositories {
  return {
    customers: customers(db),
    verifications: verifications(db),
    passwordResets: passwordResets(db),
    admins: admins(db),
    shops: shops(db),
    shopApplications: shopApplications(db),
    shopApplicationVerifications: shopApplicationVerifications(db),
    cashiers: cashiers(db),
    sessions: sessions(db),
    throttles: throttles(db),
    audit: audit(db),
    settings: settings(db),
    notifications: notifications(db),
    twoFactor: twoFactor(db),
    passwords: passwords(db),
    deletions: deletions(db),
    channels: channels(db),
    kyc: kyc(db),
    limits: limits(db),
  };
}

export function createIdentityStore(prisma: PrismaClient): IdentityStore {
  return {
    ...bind(prisma),
    transaction: async (work) => prisma.$transaction(async (tx) => work(bind(tx))),
  };
}
