import { CommandHandler } from "@zudojs/cqrs";
import type { ShopApplicationStatusView } from "@betng/contracts";
import { IDENTITY_COMMAND, SECURITY } from "../../../../constants/index.js";
import { InvalidInputError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { constantTimeEqual, normaliseEmail, verificationCodeHash } from "../../../../utils/index.js";
import { toShopApplicationStatusView } from "../../applicationView.js";
import type { VerifyShopApplicationEmailCommand } from "./verifyApplicationEmail.command.js";

type Dependencies = Pick<HandlerDependencies, "store">;

/**
 * Every way of being wrong — no such reference, the wrong address, a stale code, a wrong code, too many
 * guesses — answers the same thing, so this cannot be used to discover which applications exist.
 */
const WRONG = "That code is not right or has expired. Ask for a new one.";

export class VerifyShopApplicationEmailHandler extends CommandHandler<
  VerifyShopApplicationEmailCommand,
  ShopApplicationStatusView
> {
  public readonly commandType = IDENTITY_COMMAND.VERIFY_SHOP_APPLICATION_EMAIL;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: VerifyShopApplicationEmailCommand): Promise<ShopApplicationStatusView> {
    const { store } = this.deps;
    const application = await store.shopApplications.findByReference(command.reference);
    const applicantEmail = normaliseEmail(command.request.applicantEmail);

    if (application === undefined || application.applicantEmail !== applicantEmail) {
      throw new InvalidInputError("code", WRONG);
    }

    if (application.emailVerifiedAt !== null) {
      return toShopApplicationStatusView(application);
    }

    const latest = await store.shopApplicationVerifications.findLatest(application.id);

    if (latest === undefined) {
      throw new InvalidInputError("code", WRONG);
    }

    // The guess is counted before it is compared, so parallel guesses cannot exceed the cap.
    const claimed = await store.shopApplicationVerifications.claimAttempt(latest.id, SECURITY.MAX_VERIFICATION_ATTEMPTS);

    if (claimed === undefined || claimed.expiresAt.getTime() <= Date.now()) {
      throw new InvalidInputError("code", WRONG);
    }

    if (!constantTimeEqual(claimed.codeHash, verificationCodeHash(claimed.id, command.request.code))) {
      throw new InvalidInputError("code", WRONG);
    }

    const now = new Date();

    await store.transaction(async (repositories) => {
      await repositories.shopApplicationVerifications.consume(claimed.id, now);
      await repositories.shopApplications.markEmailVerified(application.id, now);
    });

    return toShopApplicationStatusView({ ...application, emailVerifiedAt: now });
  }
}
