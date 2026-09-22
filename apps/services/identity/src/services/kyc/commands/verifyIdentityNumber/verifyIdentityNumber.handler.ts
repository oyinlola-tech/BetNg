import { CommandHandler } from "@zudojs/cqrs";
import { isConflictError } from "@zudojs/database";
import type { IdentityCheckResult } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND, KYC } from "../../../../constants/index.js";
import { TooManyAttemptsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import type { VerifyIdentityNumberCommand } from "./verifyIdentityNumber.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "protector" | "identityVerifier" | "audit">;

const ADULT_YEARS = 18;
const IN_USE = "This number cannot be used for this account.";

function isAdult(dateOfBirth: string, now: Date): boolean {
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  const threshold = new Date(Date.UTC(now.getUTCFullYear() - ADULT_YEARS, now.getUTCMonth(), now.getUTCDate()));

  return !Number.isNaN(born.getTime()) && born <= threshold;
}

/**
 * The number goes to the provider and nowhere else: it is stored only as a keyed hash plus its last four digits, and is
 * never logged or returned. A number verified for another customer cannot verify this one.
 */
export class VerifyIdentityNumberHandler extends CommandHandler<VerifyIdentityNumberCommand, IdentityCheckResult> {
  public readonly commandType = IDENTITY_COMMAND.VERIFY_IDENTITY_NUMBER;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: VerifyIdentityNumberCommand): Promise<IdentityCheckResult> {
    const { store, resolver, protector, identityVerifier, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);
    const { check } = command;
    const now = new Date();

    const existing = (await store.kyc.latestChecks(customer.id)).find((row) => row.check === check);

    if (existing?.status === "VERIFIED") {
      return { check, status: "VERIFIED" };
    }

    if ((await store.kyc.countChecksSince(customer.id, new Date(now.getTime() - 86_400_000))) >= KYC.MAX_IDENTITY_CHECKS_PER_DAY) {
      throw new TooManyAttemptsError("Too many verification attempts today. Try again tomorrow.");
    }

    const numberHash = protector.digest(`kyc-${check.toLowerCase()}`, command.number);
    const base = { customerId: customer.id, check, numberHash, numberLast4: command.number.slice(-4) } as const;

    const record = async (status: IdentityCheckResult["status"], provider: string, reference: string | undefined, message: string | undefined): Promise<IdentityCheckResult> => {
      try {
        await store.transaction(async (repositories) => {
          await repositories.kyc.recordCheck({ ...base, status, provider, providerReference: reference, message });
          await audit.write(repositories, {
            ...customerAuditActor(customer, command.caller.requestId),
            action: AUDIT_ACTION.KYC_IDENTITY_CHECKED,
            after: { check, status, last4: base.numberLast4, provider },
          });
        });
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }

        return record("REJECTED", "platform", undefined, IN_USE);
      }

      return { check, status, ...(message === undefined ? {} : { message }) };
    };

    if (!isAdult(command.dateOfBirth, now)) {
      return record("REJECTED", "platform", undefined, "You must be 18 or older to verify this account.");
    }

    if (await store.kyc.verifiedElsewhere(check, numberHash, customer.id)) {
      return record("REJECTED", "platform", undefined, IN_USE);
    }

    const outcome = await identityVerifier.verify({ check, number: command.number, dateOfBirth: command.dateOfBirth });

    return record(outcome.status, identityVerifier.name, outcome.reference, outcome.message?.slice(0, 200));
  }
}
