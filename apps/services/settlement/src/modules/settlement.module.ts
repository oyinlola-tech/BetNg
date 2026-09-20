import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * settlement module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class SettlementModule extends BaseModule {
  public readonly id = "settlement";
  public readonly name = "settlement";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("settlement module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("settlement module stopped");
  }
}
