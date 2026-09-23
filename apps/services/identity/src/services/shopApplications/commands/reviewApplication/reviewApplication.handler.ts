import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { ShopOwnerCredentials } from "@betng/contracts";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  IDENTITY_COMMAND,
  LIST_LIMIT,
  SECURITY,
} from "../../../../constants/index.js";
import { ConflictError, InvalidInputError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies, IdentityRepositories } from "../../../../interfaces/index.js";
import { issueTemporarySecrets, normaliseShopCode } from "../../../../utils/index.js";
import { ownerUsername, shopCodeFor } from "../../applicationReference.js";
import type { ReviewShopApplicationCommand } from "./reviewApplication.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "audit" | "messenger" | "logger">;

/** Enough to clear a handful of reviewers approving at once; beyond that, something else is wrong. */
const CODE_ATTEMPTS = 5;

const STATUS = Object.freeze({
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_ACTION: "REQUIRES_ACTION",
} as const);

export interface ShopApplicationReviewResult {
  readonly reference: string;
  readonly status: "APPROVED" | "REJECTED" | "REQUIRES_ACTION";
  /** Returned once, and only on approval. */
  readonly credentials?: ShopOwnerCredentials;
}

/**
 * Approving is not a status change: it creates the shop and its first owner, and those three writes commit
 * together or not at all. The decision is conditional on the application still being open, so two reviewers
 * racing cannot both decide it.
 */
export class ReviewShopApplicationHandler extends CommandHandler<
  ReviewShopApplicationCommand,
  ShopApplicationReviewResult
> {
  public readonly commandType = IDENTITY_COMMAND.REVIEW_SHOP_APPLICATION;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ReviewShopApplicationCommand): Promise<ShopApplicationReviewResult> {
    const { store, hasher, audit } = this.deps;
    const { actor, applicationId, decision } = command;
    const application = await store.shopApplications.findById(applicationId);

    if (application === undefined) {
      throw new ResourceNotFoundError("That application does not exist.");
    }

    if (application.status === "APPROVED" || application.status === "REJECTED") {
      throw new ConflictError("That application has already been decided.");
    }

    const status = STATUS[decision.decision];

    if (status === "APPROVED" && application.emailVerifiedAt === null) {
      throw new ConflictError("The applicant has not proved their email address yet.");
    }

    const now = new Date();

    if (status !== "APPROVED") {
      const decided = await store.transaction(async (repositories) => {
        const changed = await repositories.shopApplications.decideIfOpen(applicationId, {
          status,
          reason: decision.reason,
          decidedBy: actor.id,
          decidedAt: now,
        });

        if (!changed) {
          throw new ConflictError("That application has already been decided.");
        }

        await audit.write(repositories, {
          actorId: actor.id,
          actorRole: actor.role,
          actorName: actor.name,
          action: AUDIT_ACTION.SHOP_APPLICATION_REVIEWED,
          entityType: AUDIT_ENTITY.SHOP_APPLICATION,
          entityId: applicationId,
          before: { status: application.status },
          after: { status },
          reason: decision.reason,
          severity: "NOTICE",
          requestId: actor.requestId,
        });

        return true;
      });

      if (decided) {
        await this.tellApplicant(application.applicantEmail, application.applicantName, application.reference, status, decision.reason);
      }

      return { reference: application.reference, status };
    }

    const secrets = await issueTemporarySecrets();
    const [passwordHash, pinHash] = await Promise.all([hasher.hash(secrets.password), hasher.hash(secrets.pin)]);
    const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);
    const username = ownerUsername(application.applicantName);

    const created = await this.withGeneratedCode(decision.shopCode, application.state, async (code, repositories) => {
      const shop = await repositories.shops.create({
        code,
        name: (decision.shopName ?? application.proposedShopName).trim(),
        address: `${application.address}, ${application.city}`.slice(0, 160),
        phone: application.applicantPhone,
        email: application.applicantEmail,
        ownerName: application.applicantName,
      });

      const owner = await repositories.cashiers.create({
        shopId: shop.id,
        username,
        displayName: application.applicantName,
        role: "OWNER",
        passwordHash,
        pinHash,
        credentialsExpireAt: expiresAt,
      });

      const changed = await repositories.shopApplications.decideIfOpen(applicationId, {
        status,
        reason: decision.reason,
        decidedBy: actor.id,
        decidedAt: now,
        shopId: shop.id,
      });

      if (!changed) {
        throw new ConflictError("That application has already been decided.");
      }

      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.SHOP_APPLICATION_REVIEWED,
        entityType: AUDIT_ENTITY.SHOP_APPLICATION,
        entityId: applicationId,
        before: { status: application.status },
        after: { status, shopId: shop.id, shopCode: shop.code, ownerId: owner.id, username },
        reason: decision.reason,
        severity: "CRITICAL",
        requestId: actor.requestId,
      });

      return { shopCode: shop.code };
    });

    // Best effort. The credentials are returned to the reviewer either way, and the shop already exists.
    await this.deps.messenger
      .sendTemplate({
        to: application.applicantEmail,
        template: "shop_owner_credentials",
        variables: {
          ownerName: application.applicantName,
          shopCode: created.shopCode,
          username,
          temporaryPassword: secrets.password,
          temporaryPin: secrets.pin,
          expiresInHours: String(Math.round(SECURITY.TEMPORARY_CREDENTIALS_TTL_MS / 3_600_000)),
        },
        idempotencyKey: `shop-owner-credentials-${application.reference}`,
      })
      .catch(() => {
        this.deps.logger.warn("Shop owner credentials could not be emailed", {
          event: "shop_owner_credentials_email_failed",
          reference: application.reference,
        });
      });

    await this.tellApplicant(application.applicantEmail, application.applicantName, application.reference, status, decision.reason);

    return {
      reference: application.reference,
      status,
      credentials: {
        shopCode: created.shopCode,
        username,
        temporaryPassword: secrets.password,
        temporaryPin: secrets.pin,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  /**
   * Two reviewers approving applications in the same state at the same moment would compute the same
   * next number, and the unique index on `shops.code` would refuse the second. That is the right guard,
   * but it is not the reviewer's problem, so the transaction is retried with the next number. A code the
   * reviewer chose is never retried: they asked for that one.
   */
  private async withGeneratedCode<T>(
    chosen: string | undefined,
    state: string,
    work: (code: string, repositories: IdentityRepositories) => Promise<T>,
  ): Promise<T> {
    const { store } = this.deps;
    const prefix = shopCodeFor(state, 0).slice(0, -3);

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const code =
        chosen === undefined
          ? normaliseShopCode(
              shopCodeFor(
                state,
                (await store.shops.list(LIST_LIMIT.SHOPS)).filter((shop) => shop.code.startsWith(prefix)).length +
                  1 +
                  attempt,
              ),
            )
          : normaliseShopCode(chosen);

      try {
        return await store.transaction(async (repositories) => work(code, repositories));
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }

        if (chosen !== undefined) {
          throw new InvalidInputError("shopCode", "That shop code is already in use. Choose another.");
        }
      }
    }

    throw new ConflictError("Could not allocate a shop code. Try again, or choose one.");
  }

  private async tellApplicant(
    to: string,
    applicantName: string,
    reference: string,
    status: "APPROVED" | "REJECTED" | "REQUIRES_ACTION",
    reason: string,
  ): Promise<void> {
    await this.deps.messenger
      .sendTemplate({
        to,
        template: "shop_application_decided",
        variables: {
          applicantName,
          reference,
          decision: status,
          // An approval's reason is a reviewer's note, not the applicant's business.
          reason: status === "APPROVED" ? "" : reason,
        },
        idempotencyKey: `shop-application-decided-${reference}-${status}`,
      })
      .catch(() => {
        this.deps.logger.warn("Shop application decision could not be emailed", {
          event: "application_decision_email_failed",
          reference,
        });
      });
  }
}
