import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { PinVerificationDto } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { throttleKey } from "../../../security/index.js";
import type { VerifyCashierPinCommand } from "./verifyCashierPin.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "hasher" | "throttle">;

export class VerifyCashierPinHandler extends CommandHandler<VerifyCashierPinCommand, PinVerificationDto> {
  public readonly commandType = IDENTITY_COMMAND.VERIFY_CASHIER_PIN;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: VerifyCashierPinCommand): Promise<PinVerificationDto> {
    const { store, hasher, throttle } = this.deps;
    const key = throttleKey.cashierPin(command.cashierId);

    // A PIN has at most a million values; the lockout is what makes guessing it impractical.
    await throttle.assertNotLocked(key);

    const cashier = await store.cashiers.findById(command.cashierId);

    if (cashier === undefined) {
      await hasher.verifyAgainstNothing(command.pin);
    }

    const valid =
      cashier !== undefined &&
      (await hasher.verify(command.pin, cashier.pinHash)) &&
      cashier.status === "ACTIVE";

    if (valid) {
      await throttle.clear(key);
    } else {
      await throttle.recordFailure(key);
    }

    return { valid };
  }
}
