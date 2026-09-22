import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class SubmitKycDocumentCommand extends Command<"identity.submitKycDocument"> {
  public readonly caller: CustomerCaller;

  public readonly uploadId: string;

  public constructor(caller: CustomerCaller, uploadId: string) {
    super(IDENTITY_COMMAND.SUBMIT_KYC_DOCUMENT);
    this.caller = caller;
    this.uploadId = uploadId;
  }
}
