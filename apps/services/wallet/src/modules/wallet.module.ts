import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * wallet module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class WalletModule extends BaseModule {
  public readonly id = "wallet";
  public readonly name = "wallet";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("wallet module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("wallet module stopped");
  }
}
