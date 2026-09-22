import "@testing-library/jest-dom/vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PushDevice, RegisterPushDeviceRequest } from "@betng/contracts";
import { BrowserPushCard } from "../../src/features/push/BrowserPushCard";
import { applicationServerKey, deviceLabel, pushSupport } from "../../src/features/push/webPush";
import { coarsePath, createAnalytics, createPlausibleAnalytics, noopAnalytics, trackingRefused } from "../../src/services/analytics";
import { fakeAccountServices, renderHarness, resetState } from "./harness";

const VAPID = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function device(id: string): PushDevice {
  return { id, platform: "web", label: "Chrome on Linux", current: true, registeredAt: "2026-09-22T10:00:00.000Z" };
}

interface FakeSubscription {
  readonly endpoint: string;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
  readonly toJSON: () => unknown;
}

function installBrowser(permission: NotificationPermission, answer: NotificationPermission = permission) {
  let subscription: FakeSubscription | undefined;
  const subscribe = vi.fn(async () => {
    subscription = {
      endpoint: "https://push.example.test/abc",
      unsubscribe: vi.fn(async () => {
        subscription = undefined;

        return true;
      }),
      toJSON: () => ({ endpoint: "https://push.example.test/abc", keys: { p256dh: "key", auth: "secret" } }),
    };

    return subscription;
  });
  const registration = { pushManager: { getSubscription: vi.fn(async () => subscription), subscribe } };
  const requestPermission = vi.fn(async () => answer);

  Object.defineProperty(window, "Notification", { configurable: true, value: { permission, requestPermission } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn(async () => registration) } });

  return { subscribe, requestPermission, current: () => subscription };
}

beforeEach(() => {
  resetState();
});

afterEach(() => {
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("web push", () => {
  it("is offered only when the platform publishes a key and the browser supports push", () => {
    expect(pushSupport({ serviceWorker: true, vapidPublicKey: VAPID })).toBe("unsupported");
    installBrowser("default");
    expect(pushSupport({ serviceWorker: false, vapidPublicKey: VAPID })).toBe("unsupported");
    expect(pushSupport({ serviceWorker: true, vapidPublicKey: undefined })).toBe("not-configured");
    expect(pushSupport({ serviceWorker: true, vapidPublicKey: "short" })).toBe("not-configured");
    expect(pushSupport({ serviceWorker: true, vapidPublicKey: VAPID })).toBe("available");
    expect(applicationServerKey(VAPID)).toHaveLength(65);
    expect(deviceLabel("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36")).toBe("Chrome on Linux");
  });

  it("asks for permission only on the click, registers the subscription and removes it again", async () => {
    const user = userEvent.setup();
    const browser = installBrowser("default", "granted");
    const registerPushDevice = vi.fn(async (_request: RegisterPushDeviceRequest) => device("dev-1"));
    const unregisterPushDevice = vi.fn(async () => undefined);

    renderHarness({
      routes: [{ path: "/", element: <BrowserPushCard support="available" vapidPublicKey={VAPID} /> }],
      accountServices: fakeAccountServices({ devices: { registerPushDevice, unregisterPushDevice, listPushDevices: async () => [] } }),
    });

    const turnOn = await screen.findByRole("button", { name: "Turn on browser notifications" });

    await waitFor(() => {
      expect(turnOn).toBeEnabled();
    });
    expect(browser.requestPermission).not.toHaveBeenCalled();

    await user.click(turnOn);

    await screen.findByRole("button", { name: "Turn off for this browser" });
    expect(browser.requestPermission).toHaveBeenCalledTimes(1);
    expect(browser.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));

    const request = registerPushDevice.mock.calls[0]?.[0];

    expect(request?.platform).toBe("web");
    expect(JSON.parse(request?.token ?? "{}")).toEqual({ endpoint: "https://push.example.test/abc", keys: { p256dh: "key", auth: "secret" } });

    await user.click(screen.getByRole("button", { name: "Turn off for this browser" }));

    await screen.findByRole("button", { name: "Turn on browser notifications" });
    expect(unregisterPushDevice).toHaveBeenCalledWith("dev-1");
    expect(browser.current()).toBeUndefined();
  });

  it("explains a blocked permission instead of prompting again", async () => {
    installBrowser("denied");

    renderHarness({ routes: [{ path: "/", element: <BrowserPushCard support="available" vapidPublicKey={VAPID} /> }] });

    expect(await screen.findByText(/Notifications are blocked for this site/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on browser notifications" })).not.toBeInTheDocument();
  });

  it("drops the browser subscription when the platform refuses the device", async () => {
    const user = userEvent.setup();
    const browser = installBrowser("default", "granted");

    renderHarness({
      routes: [{ path: "/", element: <BrowserPushCard support="available" vapidPublicKey={VAPID} /> }],
      accountServices: fakeAccountServices({ devices: { registerPushDevice: vi.fn(async () => Promise.reject(new Error("refused"))), listPushDevices: async () => [] } }),
    });

    const turnOn = await screen.findByRole("button", { name: "Turn on browser notifications" });

    await waitFor(() => {
      expect(turnOn).toBeEnabled();
    });
    await user.click(turnOn);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(browser.current()).toBeUndefined();
  });

  it("renders nothing when the platform does not deliver web push", () => {
    const { container } = renderHarness({ routes: [{ path: "/", element: <BrowserPushCard support="not-configured" /> }] });

    expect(container.textContent).toBe("");
  });
});

describe("analytics", () => {
  it("is a no-op unless both the domain and the collector are configured", () => {
    expect(createAnalytics({})).toBe(noopAnalytics);
    expect(createAnalytics({ VITE_ANALYTICS_DOMAIN: "betng.example" })).toBe(noopAnalytics);
    expect(createAnalytics({ VITE_ANALYTICS_DOMAIN: "betng.example", VITE_ANALYTICS_HOST: "ftp://collector.example" })).toBe(noopAnalytics);
    expect(createAnalytics({ VITE_ANALYTICS_DOMAIN: "betng.example", VITE_ANALYTICS_HOST: "https://collector.example" })).not.toBe(noopAnalytics);
  });

  it("respects Do-Not-Track and Global Privacy Control", () => {
    expect(trackingRefused({ doNotTrack: "1" } as Navigator, {})).toBe(true);
    expect(trackingRefused({ doNotTrack: null, globalPrivacyControl: true } as unknown as Navigator, {})).toBe(true);
    expect(trackingRefused({ doNotTrack: null } as Navigator, { doNotTrack: "1" })).toBe(true);
    expect(trackingRefused({ doNotTrack: null } as Navigator, {})).toBe(false);
  });

  it("sends only the event name, the route shape and coarse props", () => {
    const sent: { url: string; body: string }[] = [];
    const sink = createPlausibleAnalytics({ domain: "betng.example", host: "https://collector.example/", send: (url, body) => sent.push({ url, body }) });

    sink.page("/tickets/3f0c9a52-7a51-4c61-9f0a-5a1c2b7d8e90");
    sink.page("/payments/DEP-00012345678901234567890");
    sink.track("deposit_started", { method: "card", amount: "150000", user: "ada@example.test" });

    expect(sent[0]?.url).toBe("https://collector.example/api/event");
    expect(JSON.parse(sent[0]?.body ?? "{}")).toEqual({ name: "pageview", domain: "betng.example", url: "https://betng.example/tickets/:id" });
    expect((JSON.parse(sent[1]?.body ?? "{}") as { readonly url: string }).url).toBe("https://betng.example/payments/:id");

    const event = JSON.parse(sent[2]?.body ?? "{}") as { readonly name: string; readonly props?: Record<string, string> };

    expect(event.name).toBe("deposit_started");
    expect(event.props).toEqual({ method: "card" });
    expect(coarsePath("/matches/12345")).toBe("/matches/:id");
    expect(coarsePath("/leagues/premier-league")).toBe("/leagues/premier-league");
  });
});
