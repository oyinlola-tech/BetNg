import { randomBytes, randomUUID } from "node:crypto";
import { CommandHandler } from "@zudojs/cqrs";
import type { TwoFactorEnrollment } from "@betng/contracts";
import { ACCOUNT_SECURITY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ConflictError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { encodeBase32, TOTP_DIGITS, TOTP_STEP_SECONDS } from "../../../../utils/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { EnrollTwoFactorCommand } from "./enrollTwoFactor.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "protector">;

export const enrollmentContext = (enrollmentId: string, customerId: string): string => `totp-enrollment:${enrollmentId}:${customerId}`;

/** The secret is generated here, stored encrypted, and shown once in this answer; nothing is enabled until a code confirms it. */
export class EnrollTwoFactorHandler extends CommandHandler<EnrollTwoFactorCommand, TwoFactorEnrollment> {
  public readonly commandType = IDENTITY_COMMAND.ENROLL_TWO_FACTOR;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: EnrollTwoFactorCommand): Promise<TwoFactorEnrollment> {
    const { store, resolver, protector } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    if ((await store.twoFactor.find(customer.id)) !== undefined) {
      throw new ConflictError("Two-factor authentication is already on. Turn it off first to set it up again.");
    }

    const id = randomUUID();
    const secret = encodeBase32(randomBytes(ACCOUNT_SECURITY.TOTP_SECRET_BYTES));
    const expiresAt = new Date(Date.now() + ACCOUNT_SECURITY.ENROLLMENT_TTL_MS);

    await store.twoFactor.createEnrollment({
      id,
      customerId: customer.id,
      secretCiphertext: protector.encrypt(secret, enrollmentContext(id, customer.id)),
      expiresAt,
    });

    const issuer = ACCOUNT_SECURITY.TOTP_ISSUER;
    const label = encodeURIComponent(`${issuer}:${customer.email}`);
    const query = new URLSearchParams({
      secret,
      issuer,
      algorithm: "SHA1",
      digits: String(TOTP_DIGITS),
      period: String(TOTP_STEP_SECONDS),
    });

    return {
      enrollmentId: id,
      otpauthUri: `otpauth://totp/${label}?${query.toString()}`,
      manualKey: (secret.match(/.{1,4}/gu) ?? []).join(" "),
      expiresAt: expiresAt.toISOString(),
    };
  }
}
