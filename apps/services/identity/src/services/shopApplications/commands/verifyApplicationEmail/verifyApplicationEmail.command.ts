import { Command } from "@zudojs/cqrs";
import type { ShopApplicationVerifyRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class VerifyShopApplicationEmailCommand extends Command<"identity.verifyShopApplicationEmail"> {
  public readonly reference: string;

  public readonly request: ShopApplicationVerifyRequest;

  public readonly requestId: string;

  public constructor(payload: {
    readonly reference: string;
    readonly request: ShopApplicationVerifyRequest;
    readonly requestId: string;
  }) {
    super(IDENTITY_COMMAND.VERIFY_SHOP_APPLICATION_EMAIL);
    this.reference = payload.reference;
    this.request = payload.request;
    this.requestId = payload.requestId;
  }
}
