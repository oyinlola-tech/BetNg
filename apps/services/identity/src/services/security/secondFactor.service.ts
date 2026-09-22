import type { IdentityRepositories } from "../../interfaces/index.js";
import type { DataProtector } from "../../utils/index.js";
import { isTotpCode, normaliseBackupCode, verifyTotp } from "../../utils/index.js";

export const totpContext = (customerId: string): string => `totp:${customerId}`;

export const backupCodeHash = (protector: DataProtector, customerId: string, code: string): string =>
  protector.digest("backup-code", `${customerId}:${normaliseBackupCode(code)}`);

/**
 * A TOTP code is accepted once: its time step is claimed with a conditional update, so a replay in the same window fails.
 * A backup code is spent the same way. Call inside the transaction that grants what the code unlocks.
 */
export async function verifySecondFactor(
  repositories: IdentityRepositories,
  protector: DataProtector,
  customerId: string,
  code: string,
): Promise<"TOTP" | "BACKUP_CODE" | undefined> {
  if (isTotpCode(code)) {
    const factor = await repositories.twoFactor.find(customerId);

    if (factor === undefined) {
      return undefined;
    }

    const step = verifyTotp({
      secretBase32: protector.decrypt(factor.secretCiphertext, totpContext(customerId)),
      code,
      atMs: Date.now(),
      lastUsedStep: factor.lastStep === null ? undefined : Number(factor.lastStep),
    });

    return step !== undefined && (await repositories.twoFactor.claimStep(customerId, step)) ? "TOTP" : undefined;
  }

  const spent = await repositories.twoFactor.consumeBackupCode(customerId, backupCodeHash(protector, customerId, code), new Date());

  return spent ? "BACKUP_CODE" : undefined;
}
