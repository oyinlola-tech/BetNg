import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync([join(process.cwd(), "apps/web/sw/sw.js"), join(process.cwd(), "sw/sw.js")].find((path) => existsSync(path)) ?? "sw.js", "utf8");
const APP = "https://app.example";
const API = "https://api.example";

type Handler = (event: Record<string, unknown>) => void;

function cacheStore() {
  const caches = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    const entries = caches.get(name) ?? new Map<string, Response>();

    caches.set(name, entries);

    return {
      addAll: async (requests: readonly Request[]) => {
        for (const request of requests) entries.set(new URL(request.url, APP).href, new Response(`precached ${request.url}`));
      },
      put: async (request: Request, response: Response) => {
        entries.set(request.url, response);
      },
      match: async (request: Request | string) => entries.get(typeof request === "string" ? new URL(request, APP).href : request.url)?.clone(),
      keys: async () => [...entries.keys()].map((url) => new Request(url)),
      delete: async (request: Request) => entries.delete(request.url),
    };
  };

  return {
    caches,
    api: {
      open,
      keys: async () => [...caches.keys()],
      delete: async (name: string) => caches.delete(name),
      match: async (request: Request | string, options: { readonly cacheName: string }) => (await open(options.cacheName)).match(request),
    },
  };
}

function loadWorker(fetchImpl: (request: Request) => Promise<Response>) {
  const handlers = new Map<string, Handler>();
  const posted: unknown[] = [];
  const client = { id: "client-1", url: `${APP}/live`, focus: vi.fn(async () => undefined), postMessage: vi.fn((message: unknown) => posted.push(message)) };
  const clients = {
    get: vi.fn(async () => client),
    matchAll: vi.fn(async () => [] as (typeof client)[]),
    openWindow: vi.fn(async () => undefined),
    claim: vi.fn(async () => undefined),
  };
  const showNotification = vi.fn(async () => undefined);
  const store = cacheStore();
  const self = {
    __BETNG_BUILD__: { version: "test", apiOrigin: API, precache: ["/index.html", "/assets/index-abc.js"] },
    location: new URL(APP),
    registration: { showNotification },
    clients,
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: (type: string, handler: Handler) => {
      handlers.set(type, handler);
    },
  };
  class WorkerRequest extends Request {
    public constructor(input: string | Request, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, APP).href : input, init);
    }
  }
  const context = createContext({ self, caches: store.api, clients, fetch: vi.fn(fetchImpl), Request: WorkerRequest, Response, Headers, URL, Date, Number, Promise, Set, JSON, String, Math });

  runInContext(SOURCE, context);

  const fetchEvent = async (request: Request | Pick<Request, "method" | "url" | "mode" | "headers" | "credentials">): Promise<Response | undefined> => {
    let responded: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];

    handlers.get("fetch")?.({
      request,
      clientId: "client-1",
      respondWith: (response: Promise<Response>) => {
        responded = response;
      },
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    });

    const response = await responded;

    await Promise.all(waits);

    return response;
  };

  return { handlers, fetchEvent, store, posted, client, clients, showNotification, fetch: context["fetch"] as ReturnType<typeof vi.fn> };
}

/* Responses from a cross-origin fetch in a browser are typed "cors"; Node's constructor makes them "default". */
function json(body: unknown, headers: Record<string, string> = {}): Response {
  const response = new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });

  Object.defineProperty(response, "type", { value: "cors" });

  return response;
}

describe("service worker caching", () => {
  it("leaves non-GET, authenticated and private requests to the network, untouched", async () => {
    const worker = loadWorker(async () => json({ ok: true }));

    expect(await worker.fetchEvent(new Request(`${API}/api/v1/bets`, { method: "POST", body: "{}" }))).toBeUndefined();
    expect(await worker.fetchEvent(new Request(`${API}/api/v1/matches`, { headers: { authorization: "Bearer secret" } }))).toBeUndefined();
    expect(await worker.fetchEvent(new Request(`${API}/api/v1/bets`))).toBeUndefined();
    expect(await worker.fetchEvent(new Request(`${API}/api/v1/wallets/3f0c9a52`))).toBeUndefined();
    expect(await worker.fetchEvent(new Request(`${API}/api/v1/users/u1/notifications`))).toBeUndefined();
    expect(await worker.fetchEvent(new Request(`${API}/api/v1/matches`, { credentials: "include" }))).toBeUndefined();
    expect(worker.store.caches.get("betng-public-api-v1")?.size ?? 0).toBe(0);
  });

  it("serves public reads from the network first and falls back to a recent copy, telling the page it is stale", async () => {
    let online = true;
    const worker = loadWorker(async () => {
      if (!online) throw new TypeError("offline");

      return json({ items: [1] });
    });
    const request = () => new Request(`${API}/api/v1/matches`);

    expect(await (await worker.fetchEvent(request()))?.json()).toEqual({ items: [1] });
    expect(worker.store.caches.get("betng-public-api-v1")?.size).toBe(1);

    online = false;
    const fallback = await worker.fetchEvent(request());

    expect(await fallback?.json()).toEqual({ items: [1] });
    expect(worker.posted).toContainEqual(expect.objectContaining({ type: "betng:stale" }));

    online = true;
    await worker.fetchEvent(request());
    expect(worker.posted).toContainEqual({ type: "betng:fresh" });
  });

  it("does not keep responses the platform marks private or no-store, and refuses copies older than the limit", async () => {
    let fail = false;
    const worker = loadWorker(async (request) => {
      if (fail) throw new TypeError("offline");

      return request.url.endsWith("/config") ? json({}, { "cache-control": "private, max-age=60" }) : json({ items: [] });
    });

    await worker.fetchEvent(new Request(`${API}/api/v1/config`));
    expect(worker.store.caches.get("betng-public-api-v1")?.size ?? 0).toBe(0);

    await worker.fetchEvent(new Request(`${API}/api/v1/leagues`));
    fail = true;

    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);

    try {
      await expect(worker.fetchEvent(new Request(`${API}/api/v1/leagues`))).rejects.toThrow("offline");
    } finally {
      clock.mockRestore();
    }
  });

  it("answers navigations from the network and falls back to the precached shell", async () => {
    let online = true;
    const worker = loadWorker(async () => {
      if (!online) throw new TypeError("offline");

      return new Response("fresh page");
    });

    worker.handlers.get("install")?.({ waitUntil: (promise: Promise<unknown>) => promise });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const navigate = () => ({ method: "GET", url: `${APP}/tickets`, mode: "navigate" as RequestMode, headers: new Headers(), credentials: "same-origin" as RequestCredentials });

    expect(await (await worker.fetchEvent(navigate()))?.text()).toBe("fresh page");

    online = false;

    expect(await (await worker.fetchEvent(navigate()))?.text()).toBe(`precached ${APP}/index.html`);
  });
});

describe("service worker notifications", () => {
  it("shows the pushed title and body and keeps the link to a same-origin path", async () => {
    const worker = loadWorker(async () => json({}));
    const push = async (payload: unknown) => {
      let shown: Promise<unknown> | undefined;

      worker.handlers.get("push")?.({ data: { json: () => payload }, waitUntil: (promise: Promise<unknown>) => (shown = promise) });
      await shown;

      return worker.showNotification.mock.calls.at(-1) as unknown as [string, { body: string; data: { url: string } }];
    };

    const [title, options] = await push({ title: "Bet settled", body: "Ticket REF-1", url: "/tickets/bet-1" });

    expect(title).toBe("Bet settled");
    expect(options.body).toBe("Ticket REF-1");
    expect(options.data.url).toBe("/tickets/bet-1");

    expect((await push(null))[0]).toBe("BETNG");

    for (const url of ["https://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) expect((await push({ title: "x", url }))[1].data.url).toBe("/");
  });

  it("focuses an open window and asks it to navigate, or opens one on the app's own origin", async () => {
    const worker = loadWorker(async () => json({}));
    const click = async (url: unknown) => {
      let done: Promise<unknown> | undefined;

      worker.handlers.get("notificationclick")?.({ notification: { close: vi.fn(), data: { url } }, waitUntil: (promise: Promise<unknown>) => (done = promise) });
      await done;
    };

    await click("https://evil.example/");
    expect(worker.clients.openWindow).toHaveBeenCalledWith(`${APP}/`);

    worker.clients.matchAll.mockResolvedValue([worker.client]);
    await click("/tickets/bet-1");
    expect(worker.client.focus).toHaveBeenCalled();
    expect(worker.client.postMessage).toHaveBeenCalledWith({ type: "betng:navigate", path: "/tickets/bet-1" });
  });
});
