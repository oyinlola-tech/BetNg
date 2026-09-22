import { CommandHandler } from "@zudojs/cqrs";
import type { BackupCodes } from "@betng/contracts";
import { ACCOUNT_SECURITY, AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { generateBackupCode } from "../../../../utils/index.js";
import { backupCodeHash, resolveCaller, throttleKey, verifySecondFactor } from "../../../security/index.js";
import { codeRejected, customerAuditActor, RejectedCode } from "../../accountSecurity.helper.js";
import type { RegenerateBackupCodesCommand } from "./regenerateBackupCodes.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "throttle" | "protector" | "audit" | "messenger">;

/** Replaces the whole set: every earlier code stops working in the same transaction. */
export class RegenerateBackupCodesHandler extends CommandHandler<RegenerateBackupCodesCommand, BackupCodes> {
  public readonly commandType = IDENTITY_COMMAND.REGENERATE_BACKUP_CODES;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RegenerateBackupCodesCommand): Promise<BackupCodes> {
    const { store, resolver, throttle, protector, audit, messenger } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    if ((await store.twoFactor.find(customer.id)) === undefined) {
      throw new ConflictError("Two-factor authentication is not on.");
    }

    const key = throttleKey.secondFactor(customer.id);

    await throttle.assertNotLocked(key);

    const now = new Date();
    const codes = Array.from({ length: ACCOUNT_SECURITY.BACKUP_CODE_COUNT }, generateBackupCode);

    try {
      await store.transaction(async (repositories) => {
        if ((await verifySecondFactor(repositories, protector, customer.id, command.code)) === undefined) {
          throw new RejectedCode();
        }

        await repositories.twoFactor.replaceBackupCodes(customer.id, codes.map((code) => backupCodeHash(protector, customer.id, code)));
        await audit.write(repositories, { ...customerAuditActor(customer, command.caller.requestId), action: AUDIT_ACTION.BACKUP_CODES_REGENERATED });
      });
    } catch (error) {
      if (error instanceof RejectedCode) {
        await throttle.recordFailure(key);
        throw codeRejected();
      }

      throw error;
    }

    await throttle.clear(key);
    void messenger.securityAlert(customer.id, { kind: "BACKUP_CODES_REGENERATED" });

    return { codes, generatedAt: now.toISOString() };
  }
}
