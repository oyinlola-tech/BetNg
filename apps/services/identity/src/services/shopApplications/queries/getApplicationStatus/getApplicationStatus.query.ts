import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetShopApplicationStatusQuery extends Query<"identity.getShopApplicationStatus"> {
  public readonly reference: string;

  public readonly applicantEmail: string;

  public constructor(payload: { readonly reference: string; readonly applicantEmail: string }) {
    super(IDENTITY_QUERY.GET_SHOP_APPLICATION_STATUS);
    this.reference = payload.reference;
    this.applicantEmail = payload.applicantEmail;
  }
}
