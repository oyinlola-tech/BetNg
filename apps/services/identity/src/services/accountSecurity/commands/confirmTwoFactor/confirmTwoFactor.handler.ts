import { CommandHandler } from "@zudojs/cqrs";
import type { BackupCodes } from "@betng/contracts";
import { ACCOUNT_SECURITY, AUDIT_ACTION, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError, InvalidInputError, TooManyAttemptsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { generateBackupCode, verifyTotp } from "../../../../utils/index.js";
import { backupCodeHash, resolveCaller, totpContext } from "../../../security/index.js";
import { codeRejected, customerAuditActor } from "../../accountSecurity.helper.js";
import { enrollmentContext } from "../enrollTwoFactor/enrollTwoFactor.handler.js";
import type { ConfirmTwoFactorCommand } from "./confirmTwoFactor.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "protector" | "audit" | "messenger">;

const lapsed = (): InvalidInputError => new InvalidInputError("enrollmentId", "This setup has expired. Start again.");

/** Backup codes leave the service once, here; only their keyed hashes are stored. */
export class ConfirmTwoFactorHandler extends CommandHandler<ConfirmTwoFactorCommand, BackupCodes> {
  public readonly commandType = IDENTITY_COMMAND.CONFIRM_TWO_FACTOR;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: ConfirmTwoFactorCommand): Promise<BackupCodes> {
    const { store, resolver, protector, audit, messenger } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const now = new Date();
    const enrollment = await store.twoFactor.findEnrollment(command.request.enrollmentId);

    if (enrollment === undefined || enrollment.customerId !== customer.id || enrollment.consumedAt !== null || enrollment.expiresAt <= now) {
      throw lapsed();
    }

    if ((await store.twoFactor.find(customer.id)) !== undefined) {
      throw new ConflictError("Two-factor authentication is already on.");
    }

    if (!(await store.twoFactor.claimEnrollmentAttempt(enrollment.id, ACCOUNT_SECURITY.MAX_ENROLLMENT_ATTEMPTS))) {
      throw new TooManyAttemptsError("Too many incorrect codes. Start the setup again.");
    }

    const secret = protector.decrypt(enrollment.secretCiphertext, enrollmentContext(enrollment.id, customer.id));
    const step = verifyTotp({ secretBase32: secret, code: command.request.code, atMs: now.getTime(), lastUsedStep: undefined });

    if (step === undefined) {
      throw codeRejected();
    }

    const codes = Array.from({ length: ACCOUNT_SECURITY.BACKUP_CODE_COUNT }, generateBackupCode);

    await store.transaction(async (repositories) => {
      if (!(await repositories.twoFactor.consumeEnrollment(enrollment.id, now))) {
        throw lapsed();
      }

      await repositories.twoFactor.enable(customer.id, protector.encrypt(secret, totpContext(customer.id)), step, now);
      await repositories.twoFactor.replaceBackupCodes(customer.id, codes.map((code) => backupCodeHash(protector, customer.id, code)));
      await audit.write(repositories, { ...customerAuditActor(customer, command.caller.requestId), action: AUDIT_ACTION.TWO_FACTOR_ENABLED });
    });

    void messenger.securityAlert(customer.id, { kind: "TWO_FACTOR_ENABLED" });

    return { codes, generatedAt: now.toISOString() };
  }
}
