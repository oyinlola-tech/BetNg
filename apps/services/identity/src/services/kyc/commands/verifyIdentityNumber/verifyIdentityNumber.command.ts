import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { CustomerCaller } from "../../../security/index.js";

export class VerifyIdentityNumberCommand extends Command<"identity.verifyIdentityNumber"> {
  public readonly caller: CustomerCaller;

  public readonly check: "BVN" | "NIN";

  public readonly number: string;

  public readonly dateOfBirth: string;

  public constructor(caller: CustomerCaller, check: "BVN" | "NIN", number: string, dateOfBirth: string) {
    super(IDENTITY_COMMAND.VERIFY_IDENTITY_NUMBER);
    this.caller = caller;
    this.check = check;
    this.number = number;
    this.dateOfBirth = dateOfBirth;
  }
}
