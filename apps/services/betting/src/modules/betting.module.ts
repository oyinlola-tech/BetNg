import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * betting module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class BettingModule extends BaseModule {
  public readonly id = "betting";
  public readonly name = "betting";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("betting module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("betting module stopped");
  }
}
