import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * gateway module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class GatewayModule extends BaseModule {
  public readonly id = "gateway";
  public readonly name = "gateway";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("gateway module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("gateway module stopped");
  }
}
