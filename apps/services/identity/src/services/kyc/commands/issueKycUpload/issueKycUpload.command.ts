import { Command } from "@zudojs/cqrs";
import type { KycUploadRequest } from "@betng/contracts";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class IssueKycUploadCommand extends Command<"identity.issueKycUpload"> {
  public readonly caller: CustomerCaller;

  public readonly request: KycUploadRequest;

  public constructor(caller: CustomerCaller, request: KycUploadRequest) {
    super(IDENTITY_COMMAND.ISSUE_KYC_UPLOAD);
    this.caller = caller;
    this.request = request;
  }
}
