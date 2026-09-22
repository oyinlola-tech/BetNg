import type { ChannelPreferences, PushDevice } from "@betng/contracts";
import { parseBody } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  GetChannelPreferencesQuery,
  ListPushDevicesQuery,
  RegisterPushDeviceCommand,
  RemovePushDeviceCommand,
  UpdateChannelPreferencesCommand,
} from "../services/index.js";
import { channelPreferencesUpdateValidator, registerPushDeviceValidator } from "../validators/index.js";
import { customerCaller, uuidParam } from "./request.helper.js";

export interface ChannelsController {
  readonly getPreferences: (context: HttpRouterContext) => Promise<ChannelPreferences>;
  readonly updatePreferences: (context: HttpRouterContext) => Promise<ChannelPreferences>;
  readonly listDevices: (context: HttpRouterContext) => Promise<ListDto<PushDevice>>;
  readonly registerDevice: (context: HttpRouterContext) => Promise<PushDevice>;
  readonly removeDevice: (context: HttpRouterContext) => Promise<void>;
}

export function createChannelsController(buses: IdentityBuses): ChannelsController {
  const { commandBus, queryBus } = buses;

  return {
    getPreferences: async (context) =>
      queryBus.execute<GetChannelPreferencesQuery, ChannelPreferences>(new GetChannelPreferencesQuery(customerCaller(context))),

    updatePreferences: async (context) =>
      commandBus.execute<UpdateChannelPreferencesCommand, ChannelPreferences>(
        new UpdateChannelPreferencesCommand(customerCaller(context), parseBody(context.request, channelPreferencesUpdateValidator).channels),
      ),

    listDevices: async (context) => ({
      items: await queryBus.execute<ListPushDevicesQuery, readonly PushDevice[]>(new ListPushDevicesQuery(customerCaller(context))),
    }),

    registerDevice: async (context) =>
      commandBus.execute<RegisterPushDeviceCommand, PushDevice>(
        new RegisterPushDeviceCommand(customerCaller(context), parseBody(context.request, registerPushDeviceValidator)),
      ),

    removeDevice: async (context) =>
      commandBus.execute<RemovePushDeviceCommand>(new RemovePushDeviceCommand(customerCaller(context), uuidParam(context, "id"))),
  };
}
