import { randomUUID } from "node:crypto";
import { CommandHandler } from "@zudojs/cqrs";
import type { PushDevice } from "@betng/contracts";
import { DELIVERY, IDENTITY_COMMAND } from "../../../../constants/index.js";
import { toPushDevice } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { RegisterPushDeviceCommand } from "./registerPushDevice.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "protector">;

export const pushTokenHash = (protector: HandlerDependencies["protector"], token: string): string => protector.digest("push-token", token);

/**
 * The token is looked up by keyed hash and kept encrypted for sending. A token already registered moves to this customer
 * (a shared device changed hands); its ciphertext is bound to the device row, so it is re-sealed for that row.
 */
export class RegisterPushDeviceHandler extends CommandHandler<RegisterPushDeviceCommand, PushDevice> {
  public readonly commandType = IDENTITY_COMMAND.REGISTER_PUSH_DEVICE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RegisterPushDeviceCommand): Promise<PushDevice> {
    const { store, resolver, protector } = this.deps;
    const { customer, session } = await resolveCaller(resolver, store, command.caller);
    const tokenHash = pushTokenHash(protector, command.request.token);
    const id = randomUUID();
    const now = new Date();

    const device = await store.transaction(async (repositories) => {
      await repositories.channels.removeByTokenHash(tokenHash);

      const created = await repositories.channels.upsertDevice(
        {
          id,
          customerId: customer.id,
          platform: command.request.platform,
          label: command.request.label,
          tokenHash,
          tokenCiphertext: protector.encrypt(command.request.token, `push:${id}`),
          sessionId: session?.id,
        },
        now,
      );

      await repositories.channels.trimDevices(customer.id, DELIVERY.MAX_PUSH_DEVICES);

      return created;
    });

    return toPushDevice(device, session?.id);
  }
}
