import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AccountStatus } from "../../../../generated/prisma/client.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class SetAdminStatusCommand extends Command<"identity.setAdminStatus"> {
  public readonly actor: AdminActor;

  public readonly adminId: string;

  public readonly status: AccountStatus;

  public readonly reason: string;

  public constructor(payload: {
    readonly actor: AdminActor;
    readonly adminId: string;
    readonly status: AccountStatus;
    readonly reason: string;
  }) {
    super(IDENTITY_COMMAND.SET_ADMIN_STATUS);
    this.actor = payload.actor;
    this.adminId = payload.adminId;
    this.status = payload.status;
    this.reason = payload.reason;
  }
}
