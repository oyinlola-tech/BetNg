import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class SetShopStatusCommand extends Command<"identity.setShopStatus"> {
  public readonly actor: AdminActor;

  public readonly shopId: string;

  public readonly status: "ACTIVE" | "SUSPENDED";

  public readonly reason: string;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly shopId: string;
    readonly status: "ACTIVE" | "SUSPENDED";
    readonly reason: string;
  }) {
    super(IDENTITY_COMMAND.SET_SHOP_STATUS);
    this.actor = payload.actor;
    this.shopId = payload.shopId;
    this.status = payload.status;
    this.reason = payload.reason;
  }
}
