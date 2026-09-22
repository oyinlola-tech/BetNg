import { CommandHandler } from "@zudojs/cqrs";
import type { KycReviewItem, KycStatus } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { toKycReviewItem } from "../../kycReview.helper.js";
import type { ReviewKycCommand } from "./reviewKyc.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "audit" | "messenger">;

const NOTICE: Readonly<Record<"APPROVE" | "REJECT" | "REQUEST_ACTION", string>> = {
  APPROVE: "Your documents were approved",
  REJECT: "Your documents were not accepted",
  REQUEST_ACTION: "Your verification needs attention",
};

const OUTCOME: Readonly<Record<"APPROVE" | "REJECT" | "REQUEST_ACTION", KycStatus>> = {
  APPROVE: "VERIFIED",
  REJECT: "REJECTED",
  REQUEST_ACTION: "REQUIRES_ACTION",
};

/** The decision applies to every document waiting for review, and it is audited in the same transaction or not at all. */
export class ReviewKycHandler extends CommandHandler<ReviewKycCommand, KycReviewItem> {
  public readonly commandType = IDENTITY_COMMAND.REVIEW_KYC;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ReviewKycCommand): Promise<KycReviewItem> {
    const { store, audit } = this.deps;
    const { actor, decision } = command;
    const customer = await store.customers.findById(command.customerId);

    if (customer === undefined) {
      throw new ResourceNotFoundError("No customer has that id.");
    }

    const status = OUTCOME[decision.decision];
    const now = new Date();

    await store.transaction(async (repositories) => {
      const changed = await repositories.kyc.decidePending(
        customer.id,
        status,
        status === "VERIFIED" ? undefined : decision.reason,
        actor.id,
        now,
      );

      if (changed === 0) {
        throw new ConflictError("Nothing from this customer is waiting for review.");
      }

      await repositories.kyc.saveProfile(customer.id, status, decision.reason, actor.id, now);
      await audit.write(repositories, {
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        action: AUDIT_ACTION.KYC_REVIEWED,
        entityType: AUDIT_ENTITY.CUSTOMER,
        entityId: customer.id,
        after: { decision: decision.decision, documents: changed },
        reason: decision.reason,
        severity: decision.decision === "APPROVE" ? "INFO" : "NOTICE",
        requestId: actor.requestId,
      });
    });

    void this.deps.messenger.notice(customer.id, {
      kind: "KYC_UPDATED",
      title: NOTICE[decision.decision],
      body: decision.decision === "APPROVE" ? "Your verification has been updated." : decision.reason,
      data: { decision: decision.decision },
    });

    return toKycReviewItem(store, customer);
  }
}
