import type { PushDevice, PushPlatform, RegisterPushDeviceRequest } from "@betng/contracts";

export type PushPermission = "granted" | "denied" | "undetermined" | "unavailable";

/** The device side of push: permission and the provider token. Provider credentials stay on the platform. */
export interface PushNotifications {
  permission(): Promise<PushPermission>;
  requestPermission(): Promise<PushPermission>;
  deviceToken(): Promise<string | undefined>;
}

/** expo-notifications is not installed in this workspace. */
export function createUnavailablePushNotifications(): PushNotifications {
  return {
    permission: () => Promise.resolve("unavailable"),
    requestPermission: () => Promise.resolve("unavailable"),
    deviceToken: () => Promise.resolve(undefined),
  };
}

export type PushRegistration =
  | { readonly status: "registered"; readonly device: PushDevice }
  | { readonly status: "denied" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed"; readonly error: unknown };

export interface PushRegistrar {
  registerPushDevice(request: RegisterPushDeviceRequest): Promise<PushDevice>;
}

const TOKEN = /^[\x21-\x7e]{16,4096}$/;

/** Asks for permission, then hands the token to the platform. The token is never logged or stored by the app. */
export async function registerForPush(
  push: PushNotifications,
  registrar: PushRegistrar,
  device: { readonly platform: PushPlatform; readonly label: string },
): Promise<PushRegistration> {
  let permission = await push.permission();

  if (permission === "undetermined") permission = await push.requestPermission();
  if (permission === "unavailable") return { status: "unavailable" };
  if (permission !== "granted") return { status: "denied" };

  const token = await push.deviceToken();

  if (token === undefined || !TOKEN.test(token)) return { status: "unavailable" };

  try {
    return { status: "registered", device: await registrar.registerPushDevice({ platform: device.platform, token, label: device.label.slice(0, 80) }) };
  } catch (error) {
    return { status: "failed", error };
  }
}
