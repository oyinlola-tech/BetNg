import { CommandHandler } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { RemovePushDeviceCommand } from "./removePushDevice.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class RemovePushDeviceHandler extends CommandHandler<RemovePushDeviceCommand> {
  public readonly commandType = IDENTITY_COMMAND.REMOVE_PUSH_DEVICE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: RemovePushDeviceCommand): Promise<void> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    if (!(await store.channels.removeDevice(customer.id, command.deviceId))) {
      throw new ResourceNotFoundError("There is no such device on your account.");
    }
  }
}
