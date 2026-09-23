import { Command } from "@zudojs/cqrs";
import type { ShopApplicationRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";

export class SubmitShopApplicationCommand extends Command<"identity.submitShopApplication"> {
  public readonly request: ShopApplicationRequest;

  public readonly requestId: string;

  public constructor(payload: { readonly request: ShopApplicationRequest; readonly requestId: string }) {
    super(IDENTITY_COMMAND.SUBMIT_SHOP_APPLICATION);
    this.request = payload.request;
    this.requestId = payload.requestId;
  }
}
