import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class ListPushDevicesQuery extends Query<"identity.listPushDevices"> {
  public readonly caller: CustomerCaller;

  public constructor(caller: CustomerCaller) {
    super(IDENTITY_QUERY.LIST_PUSH_DEVICES);
    this.caller = caller;
  }
}
