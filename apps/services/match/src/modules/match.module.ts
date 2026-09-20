import { BaseModule, type ModuleContext } from "@zudojs/core";

/**
 * match module.
 *
 * Registered with the runtime in app.ts. The runtime calls onInitialize
 * during start and onShutdown during stop.
 */
export class MatchModule extends BaseModule {
  public readonly id = "match";
  public readonly name = "match";

  public constructor() {
    super({ version: "0.1.0" });
  }

  public override async onInitialize(context: ModuleContext): Promise<void> {
    context.logger.info("match module initialized");
  }

  public override async onShutdown(context: ModuleContext): Promise<void> {
    context.logger.info("match module stopped");
  }
}
