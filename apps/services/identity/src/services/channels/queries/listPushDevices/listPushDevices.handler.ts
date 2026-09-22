import { QueryHandler } from "@zudojs/cqrs";
import type { PushDevice } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toPushDevice } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { ListPushDevicesQuery } from "./listPushDevices.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class ListPushDevicesHandler extends QueryHandler<ListPushDevicesQuery, readonly PushDevice[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_PUSH_DEVICES;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListPushDevicesQuery): Promise<readonly PushDevice[]> {
    const { store, resolver } = this.deps;
    const { customer, session } = await resolveCaller(resolver, store, query.caller);

    return (await store.channels.listDevices(customer.id)).map((row) => toPushDevice(row, session?.id));
  }
}
