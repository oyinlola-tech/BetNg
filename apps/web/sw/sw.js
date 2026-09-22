const BUILD = self.__BETNG_BUILD__;
const SHELL_CACHE = `betng-shell-${BUILD.version}`;
const API_CACHE = "betng-public-api-v1";
const API_ORIGIN = BUILD.apiOrigin;
const API_PREFIX = "/api/v1";
const STALE_MAX_AGE_MS = 10 * 60 * 1000;
const API_CACHE_LIMIT = 80;
const CACHED_AT = "x-betng-cached-at";

/* Anonymous catalogue reads only. Anything under users, bets, wallets, auth, account, payments or admin never matches. */
const PUBLIC_API = /^\/api\/v1\/(?:config|leagues(?:\/[A-Za-z0-9_-]+(?:\/(?:standings|scorers|matchdays))?)?|teams(?:\/[A-Za-z0-9_-]+)?|fixtures|results|odds|matches(?:\/[A-Za-z0-9_-]+(?:\/(?:events|stats|odds|lineups|head-to-head))?)?)$/;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/;

function safePath(candidate) {
  if (typeof candidate !== "string" || candidate.length > 200 || candidate.includes("\\") || !SAFE_PATH.test(candidate)) return "/";

  return candidate;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(BUILD.precache.map((path) => new Request(path, { cache: "reload" })))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(names.filter((name) => name.startsWith("betng-") && name !== SHELL_CACHE && name !== API_CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.origin !== self.location.origin) return;
  if (event.data && event.data.type === "betng:skip-waiting") void self.skipWaiting();
});

function isPublicApiRequest(request, url) {
  if (API_ORIGIN === "" || url.origin !== API_ORIGIN || !PUBLIC_API.test(url.pathname)) return false;
  if (request.headers.has("authorization") || request.credentials === "include") return false;

  return url.pathname.startsWith(API_PREFIX);
}

function cacheable(response) {
  if (!response.ok || response.status !== 200) return false;
  if (response.type !== "basic" && response.type !== "cors") return false;

  const control = (response.headers.get("cache-control") || "").toLowerCase();

  return !control.includes("no-store") && !control.includes("private");
}

async function notify(clientId, message) {
  if (!clientId) return;

  const client = await self.clients.get(clientId);

  if (client) client.postMessage(message);
}

const staleClients = new Set();

async function remember(request, response) {
  const cache = await caches.open(API_CACHE);
  const headers = new Headers(response.headers);

  headers.set(CACHED_AT, String(Date.now()));
  await cache.put(request, new Response(await response.arrayBuffer(), { status: response.status, statusText: response.statusText, headers }));

  const keys = await cache.keys();

  for (const stale of keys.slice(0, Math.max(0, keys.length - API_CACHE_LIMIT))) await cache.delete(stale);
}

async function publicApi(event, request) {
  try {
    const response = await fetch(request);

    if (cacheable(response)) event.waitUntil(remember(request, response.clone()));

    if (staleClients.has(event.clientId)) {
      staleClients.delete(event.clientId);
      event.waitUntil(notify(event.clientId, { type: "betng:fresh" }));
    }

    return response;
  } catch (error) {
    const cached = await (await caches.open(API_CACHE)).match(request);
    const cachedAt = cached ? Number(cached.headers.get(CACHED_AT)) : Number.NaN;

    if (!cached || !Number.isFinite(cachedAt) || Date.now() - cachedAt > STALE_MAX_AGE_MS) throw error;

    staleClients.add(event.clientId);
    event.waitUntil(notify(event.clientId, { type: "betng:stale", cachedAt }));

    return cached;
  }
}

async function navigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const shell = await caches.match("/index.html", { cacheName: SHELL_CACHE });

    if (shell) return shell;
    throw error;
  }
}

async function shellAsset(request) {
  const hit = await caches.match(request, { cacheName: SHELL_CACHE });

  return hit || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isPublicApiRequest(request, url)) {
    event.respondWith(publicApi(event, request));

    return;
  }

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && !url.pathname.startsWith("/api/")) event.respondWith(navigation(request));
  else if (BUILD.precache.includes(url.pathname) && url.search === "") event.respondWith(shellAsset(request));
});

function readPush(event) {
  let data;

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  if (data === null || typeof data !== "object") data = {};

  const text = (value, max) => (typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, max) : undefined);

  return {
    title: text(data.title, 80) || "BETNG",
    body: text(data.body, 240) || "",
    url: safePath(data.url),
    tag: text(data.tag, 64),
  };
}

self.addEventListener("push", (event) => {
  const message = readPush(event);

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: message.url },
      ...(message.tag === undefined ? {} : { tag: message.tag }),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin);

  event.waitUntil(
    (async () => {
      const open = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = open.find((client) => new URL(client.url).origin === self.location.origin);

      if (existing) {
        await existing.focus();
        existing.postMessage({ type: "betng:navigate", path: target.pathname + target.search });

        return;
      }

      await clients.openWindow(target.href);
    })(),
  );
});
