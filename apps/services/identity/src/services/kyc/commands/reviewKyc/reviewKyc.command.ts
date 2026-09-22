import { Command } from "@zudojs/cqrs";
import type { KycReviewDecision } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class ReviewKycCommand extends Command<"identity.reviewKyc"> {
  public readonly actor: AdminActor;

  public readonly customerId: string;

  public readonly decision: KycReviewDecision;

  public constructor(actor: AdminActor, customerId: string, decision: KycReviewDecision) {
    super(IDENTITY_COMMAND.REVIEW_KYC);
    this.actor = actor;
    this.customerId = customerId;
    this.decision = decision;
  }
}
