import { Command } from "@zudojs/cqrs";
import type { AccountDeletionRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class RequestAccountDeletionCommand extends Command<"identity.requestAccountDeletion"> {
  public readonly caller: CustomerCaller;

  public readonly request: AccountDeletionRequest;

  public readonly idempotencyKey: string;

  public constructor(caller: CustomerCaller, request: AccountDeletionRequest, idempotencyKey: string) {
    super(IDENTITY_COMMAND.REQUEST_ACCOUNT_DELETION);
    this.caller = caller;
    this.request = request;
    this.idempotencyKey = idempotencyKey;
  }
}
