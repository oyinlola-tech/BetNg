import type { DevicesSource } from "@betng/ui-core";

export type PushSupport = "unsupported" | "not-configured" | "available";

const VAPID_KEY = /^[A-Za-z0-9_-]{80,100}$/;
const DEVICE_KEY = "betng.push.device";

export interface PushEnvironment {
  readonly serviceWorker: boolean;
  readonly vapidPublicKey: string | undefined;
}

export function pushSupport(env: PushEnvironment): PushSupport {
  if (!env.serviceWorker || typeof window === "undefined" || !("PushManager" in window) || !("Notification" in window)) return "unsupported";

  return env.vapidPublicKey !== undefined && VAPID_KEY.test(env.vapidPublicKey) ? "available" : "not-configured";
}

export function applicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);

  return bytes;
}

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const PLATFORMS: readonly (readonly [RegExp, string])[] = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

/** A coarse label the customer can recognise in their device list, e.g. "Firefox on Android". */
export function deviceLabel(userAgent: string): string {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? "Browser";
  const platform = PLATFORMS.find(([pattern]) => pattern.test(userAgent))?.[1];

  return platform === undefined ? browser : `${browser} on ${platform}`;
}

function readDeviceId(): string | undefined {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeDeviceId(id: string | undefined): void {
  try {
    if (id === undefined) localStorage.removeItem(DEVICE_KEY);
    else localStorage.setItem(DEVICE_KEY, id);
  } catch {}
}

export function rememberedDeviceId(): string | undefined {
  return readDeviceId();
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? undefined;
}

export async function currentSubscription(): Promise<PushSubscription | undefined> {
  const reg = await registration();

  return (await reg?.pushManager.getSubscription()) ?? undefined;
}

export type EnableResult = "enabled" | "denied" | "dismissed";

/** Must be called from a user gesture: it may show the browser's permission prompt. */
export async function enablePush(devices: DevicesSource, vapidPublicKey: string): Promise<EnableResult> {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") return permission === "denied" ? "denied" : "dismissed";

  const reg = await registration();

  if (reg === undefined) throw new Error("The service worker is not registered.");

  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(vapidPublicKey) }));

  try {
    const device = await devices.registerPushDevice({ platform: "web", token: JSON.stringify(subscription), label: deviceLabel(navigator.userAgent) });

    writeDeviceId(device.id);
  } catch (error) {
    await subscription.unsubscribe().catch(() => false);
    throw error;
  }

  return "enabled";
}

/** Stops delivery to this browser: the platform forgets the device and the browser drops the subscription, even if one of the two fails. */
export async function disablePush(devices: DevicesSource, fallbackDeviceId?: string): Promise<void> {
  const id = readDeviceId() ?? fallbackDeviceId;
  const subscription = await currentSubscription().catch(() => undefined);
  let failure: unknown;

  if (id !== undefined) {
    try {
      await devices.unregisterPushDevice(id);
    } catch (error) {
      failure = error;
    }
  }

  await subscription?.unsubscribe().catch(() => false);
  writeDeviceId(undefined);

  if (failure !== undefined) throw failure instanceof Error ? failure : new Error("The device could not be removed.");
}

/** Best effort on sign-out, so a shared browser stops receiving the last customer's alerts. */
export async function releasePushOnSignOut(devices: () => DevicesSource): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const subscription = await currentSubscription().catch(() => undefined);

  if (subscription === undefined && readDeviceId() === undefined) return;

  const release = Promise.resolve()
    .then(() => disablePush(devices()))
    .catch(() => undefined);

  await Promise.race([release, new Promise((resolve) => setTimeout(resolve, 3_000))]);
}
