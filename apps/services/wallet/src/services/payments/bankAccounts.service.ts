import type {
  Bank,
  BankAccount,
  BankAccountVerification,
  BankAccountVerifyRequest,
  SaveBankAccountRequest,
} from "@betng/contracts";
import { ErrorCodes } from "@betng/contracts";
import { tooManyRequests } from "@betng/service-kit";
import { VERIFICATION_TTL_MS } from "../../constants/payments.constant.js";
import { paymentErrors } from "../../errors/index.js";
import { ProviderRefusedError, ProviderUnavailableError } from "../../providers/index.js";
import type { PaymentProvider, ProviderRegistry } from "../../providers/index.js";
import type { BankAccountsRepository } from "../../repositories/bankAccounts.repository.js";
import type { FieldCipher } from "../../security/crypto.js";
import { toBankAccount, toVerification } from "../../utils/index.js";

export interface BankAccountsServiceDeps {
  readonly registry: ProviderRegistry;
  readonly bankAccounts: BankAccountsRepository;
  readonly cipher: FieldCipher | undefined;
}

const NAME_ENQUIRIES_PER_HOUR = 20;

function cleanName(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

export class BankAccountsService {
  private readonly deps: BankAccountsServiceDeps;

  public constructor(deps: BankAccountsServiceDeps) {
    this.deps = deps;
  }

  private provider(): PaymentProvider {
    const provider = this.deps.registry.active;

    if (provider === undefined || !provider.configured) {
      throw paymentErrors.providerUnavailable();
    }

    return provider;
  }

  private cipher(): FieldCipher {
    if (this.deps.cipher === undefined) {
      throw paymentErrors.notConfigured("Bank account storage");
    }

    return this.deps.cipher;
  }

  public async banks(): Promise<readonly Bank[]> {
    try {
      return await this.deps.registry.banks(this.provider());
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof ProviderRefusedError) {
        throw paymentErrors.providerUnavailable();
      }

      throw error;
    }
  }

  public async verify(userId: string, request: BankAccountVerifyRequest): Promise<BankAccountVerification> {
    const cipher = this.cipher();
    const provider = this.provider();

    if ((await this.deps.bankAccounts.recentVerifications(userId, new Date(Date.now() - 3_600_000))) >= NAME_ENQUIRIES_PER_HOUR) {
      throw tooManyRequests("Too many account checks. Try again later.", { code: ErrorCodes.RATE_LIMITED, expose: true });
    }

    const bank = (await this.banks()).find((entry) => entry.code === request.bankCode);

    if (bank === undefined) {
      throw paymentErrors.invalid("That bank is not supported.");
    }

    let resolved;

    try {
      resolved = await provider.resolveAccount(request.bankCode, request.accountNumber);
    } catch (error) {
      if (error instanceof ProviderUnavailableError || error instanceof ProviderRefusedError) {
        throw paymentErrors.providerUnavailable();
      }

      throw error;
    }

    const accountName = resolved === undefined ? "" : cleanName(resolved.accountName);

    if (accountName === "") {
      throw paymentErrors.invalid("No account matches that number at this bank.");
    }

    const verification = await this.deps.bankAccounts.createVerification({
      userId,
      provider: provider.id,
      bankCode: bank.code,
      bankName: bank.name,
      accountNumberEncrypted: cipher.encrypt(request.accountNumber, userId),
      accountNumberHash: cipher.lookupHash(`${request.bankCode}:${request.accountNumber}`),
      last4: request.accountNumber.slice(-4),
      accountName,
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    });

    return toVerification(verification);
  }

  public async save(userId: string, request: SaveBankAccountRequest): Promise<BankAccount> {
    this.cipher();

    const outcome = await this.deps.bankAccounts.saveFromVerification(userId, request.verificationId, request.makeDefault, new Date());

    if (outcome.kind === "MISSING") {
      throw paymentErrors.notFound("That verification has expired or was already used. Verify the account again.");
    }

    if (outcome.kind === "DUPLICATE") {
      throw paymentErrors.conflict("That account is already saved.");
    }

    return toBankAccount(outcome.account);
  }

  public async list(userId: string): Promise<{ readonly items: readonly BankAccount[] }> {
    return { items: (await this.deps.bankAccounts.list(userId)).map(toBankAccount) };
  }

  public async makeDefault(userId: string, id: string): Promise<BankAccount> {
    const account = await this.deps.bankAccounts.makeDefault(userId, id);

    if (account === undefined) {
      throw paymentErrors.notFound("That bank account is not on your profile.");
    }

    return toBankAccount(account);
  }

  public async remove(userId: string, id: string): Promise<void> {
    let removed: boolean;

    try {
      removed = await this.deps.bankAccounts.remove(userId, id);
    } catch (error) {
      if (typeof error === "object" && error !== null && (error as { inFlight?: unknown }).inFlight === true) {
        throw paymentErrors.conflict("A withdrawal to this account is still in progress.");
      }

      throw error;
    }

    if (!removed) {
      throw paymentErrors.notFound("That bank account is not on your profile.");
    }
  }
}
