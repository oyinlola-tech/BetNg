import { useSyncExternalStore } from "react";
import { analytics } from "../services/analytics";

interface InstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

export interface PwaState {
  /** A new version finished installing and waits for a reload. */
  readonly updateReady: boolean;
  readonly installable: boolean;
  /** Set while public data on screen came from the offline copy, with the time it was saved. */
  readonly staleSince: number | undefined;
}

let state: PwaState = { updateReady: false, installable: false, staleSince: undefined };
const listeners = new Set<() => void>();
let installPrompt: InstallPromptEvent | undefined;
let waiting: ServiceWorker | undefined;
let navigateTo: ((path: string) => void) | undefined;

function set(next: Partial<PwaState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function onNotificationNavigate(handler: ((path: string) => void) | undefined): void {
  navigateTo = handler;
}

const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/;

function handleMessage(event: MessageEvent<unknown>): void {
  const data = event.data as { readonly type?: unknown; readonly cachedAt?: unknown; readonly path?: unknown } | null;

  if (data === null || typeof data !== "object") return;

  if (data.type === "betng:stale" && typeof data.cachedAt === "number") set({ staleSince: Math.min(data.cachedAt, state.staleSince ?? Number.POSITIVE_INFINITY) });
  else if (data.type === "betng:fresh") set({ staleSince: undefined });
  else if (data.type === "betng:navigate" && typeof data.path === "string" && data.path.length <= 200 && SAFE_PATH.test(data.path) && !data.path.includes("\\")) navigateTo?.(data.path);
}

function watchInstalling(registration: ServiceWorkerRegistration): void {
  const worker = registration.installing;

  worker?.addEventListener("statechange", () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller !== null) {
      waiting = worker;
      set({ updateReady: true });
    }
  });
}

/** Captures the browser's install offer so it can be shown from a menu instead of on its own. */
export function listenForInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    set({ installable: true });
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    set({ installable: false });
    analytics.track("app_installed");
  });
}

export async function promptInstall(): Promise<boolean> {
  const prompt = installPrompt;

  if (prompt === undefined) return false;

  installPrompt = undefined;
  set({ installable: false });
  await prompt.prompt();

  return (await prompt.userChoice).outcome === "accepted";
}

export function serviceWorkerEnabled(): boolean {
  return import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!serviceWorkerEnabled()) return undefined;

  navigator.serviceWorker.addEventListener("message", handleMessage);

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

  if (registration.waiting !== null && navigator.serviceWorker.controller !== null) {
    waiting = registration.waiting;
    set({ updateReady: true });
  }

  registration.addEventListener("updatefound", () => {
    watchInstalling(registration);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void registration.update().catch(() => undefined);
  });

  return registration;
}

export function applyUpdate(): void {
  const worker = waiting;

  if (worker === undefined) {
    window.location.reload();

    return;
  }

  let reloaded = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;

    reloaded = true;
    window.location.reload();
  });
  worker.postMessage({ type: "betng:skip-waiting" });
}

export function __resetPwaForTests(next: Partial<PwaState> = {}): void {
  state = { updateReady: false, installable: false, staleSince: undefined, ...next };
  installPrompt = undefined;
  waiting = undefined;
  for (const listener of listeners) listener();
}

export function __handleWorkerMessageForTests(data: unknown): void {
  handleMessage(new MessageEvent("message", { data }));
}

export function __setInstallPromptForTests(prompt: InstallPromptEvent): void {
  installPrompt = prompt;
  set({ installable: true });
}
