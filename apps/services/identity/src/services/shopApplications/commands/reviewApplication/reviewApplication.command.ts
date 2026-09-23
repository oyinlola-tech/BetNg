import { Command } from "@zudojs/cqrs";
import type { ShopApplicationDecision } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class ReviewShopApplicationCommand extends Command<"identity.reviewShopApplication"> {
  public readonly actor: AdminActor;

  public readonly applicationId: string;

  public readonly decision: ShopApplicationDecision;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly applicationId: string;
    readonly decision: ShopApplicationDecision;
  }) {
    super(IDENTITY_COMMAND.REVIEW_SHOP_APPLICATION);
    this.actor = payload.actor;
    this.applicationId = payload.applicationId;
    this.decision = payload.decision;
  }
}
