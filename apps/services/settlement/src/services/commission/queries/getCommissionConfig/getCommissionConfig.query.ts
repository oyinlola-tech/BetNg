import { Query } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";

export class GetCommissionConfigQuery extends Query<"settlement.getCommissionConfig"> {
  public constructor() {
    super(SETTLEMENT_QUERY.GET_COMMISSION_CONFIG);
  }
}
