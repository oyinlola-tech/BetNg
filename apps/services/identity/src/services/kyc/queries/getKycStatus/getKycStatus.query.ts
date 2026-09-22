import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";

export class GetKycStatusQuery extends Query<"identity.getKycStatus"> {
  public readonly customerId: string;

  public constructor(customerId: string) {
    super(IDENTITY_QUERY.GET_KYC_STATUS);
    this.customerId = customerId;
  }
}
