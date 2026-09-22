export type AnalyticsEvent =
  | "bet_slip_opened"
  | "bet_submitted"
  | "bet_accepted"
  | "bet_refused"
  | "deposit_started"
  | "deposit_confirmed"
  | "withdrawal_started"
  | "withdrawal_confirmed"
  | "push_enabled"
  | "app_installed";

/** Coarse, enumerable values only: never ids, amounts, names or free text. */
export type AnalyticsProps = Readonly<Record<string, string>>;

export interface AnalyticsSink {
  readonly page: (path: string) => void;
  readonly track: (event: AnalyticsEvent, props?: AnalyticsProps) => void;
}

export const noopAnalytics: AnalyticsSink = { page: () => undefined, track: () => undefined };

const DOMAIN = /^(?=.{1,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const PROP_VALUE = /^[a-z][a-z0-9_]{0,31}$/;
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+|[A-Za-z0-9_-]{20,})$/i;

/** The route shape of a path: query, hash and anything that looks like an identifier are dropped. */
export function coarsePath(pathname: string): string {
  const segments = pathname.split("/").map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment));

  return segments.join("/").replace(/[^A-Za-z0-9/:_-]/g, "") || "/";
}

function coarseProps(props: AnalyticsProps | undefined): Record<string, string> | undefined {
  if (props === undefined) return undefined;

  const entries = Object.entries(props).filter(([key, value]) => PROP_VALUE.test(key) && PROP_VALUE.test(value));

  return entries.length === 0 ? undefined : Object.fromEntries(entries.slice(0, 8));
}

export function trackingRefused(nav: Navigator & { readonly globalPrivacyControl?: boolean }, win: { readonly doNotTrack?: string | null }): boolean {
  return nav.doNotTrack === "1" || win.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export interface PlausibleOptions {
  readonly domain: string;
  /** Origin of the Plausible-compatible collector, e.g. https://plausible.io. */
  readonly host: string;
  readonly send?: (url: string, body: string) => void;
}

function beacon(url: string, body: string): void {
  const blob = new Blob([body], { type: "text/plain" });

  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob)) return;

  void fetch(url, { method: "POST", body, keepalive: true, credentials: "omit", referrerPolicy: "no-referrer", headers: { "Content-Type": "text/plain" } }).catch(() => undefined);
}

/** Cookieless event collection in the Plausible Events API shape. Only the event name, the route shape and coarse props leave the browser. */
export function createPlausibleAnalytics(options: PlausibleOptions): AnalyticsSink {
  const endpoint = `${options.host.replace(/\/+$/, "")}/api/event`;
  const send = options.send ?? beacon;
  const post = (name: string, path: string, props?: Record<string, string>): void => {
    send(endpoint, JSON.stringify({ name, domain: options.domain, url: `https://${options.domain}${coarsePath(path)}`, ...(props === undefined ? {} : { props }) }));
  };

  return {
    page: (path) => {
      post("pageview", path);
    },
    track: (event, props) => {
      post(event, typeof location === "undefined" ? "/" : location.pathname, coarseProps(props));
    },
  };
}

function validHost(value: string): boolean {
  try {
    const url = new URL(value);

    return url.origin === value.replace(/\/+$/, "") && (url.protocol === "https:" || (import.meta.env.DEV && url.protocol === "http:"));
  } catch {
    return false;
  }
}

export function createAnalytics(env: { readonly VITE_ANALYTICS_DOMAIN?: string | undefined; readonly VITE_ANALYTICS_HOST?: string | undefined }): AnalyticsSink {
  const domain = env.VITE_ANALYTICS_DOMAIN?.trim() ?? "";
  const host = env.VITE_ANALYTICS_HOST?.trim() ?? "";

  if (!DOMAIN.test(domain) || !validHost(host)) return noopAnalytics;
  if (typeof navigator === "undefined" || trackingRefused(navigator, window as { readonly doNotTrack?: string | null })) return noopAnalytics;

  return createPlausibleAnalytics({ domain, host });
}

let sink: AnalyticsSink | undefined;

function active(): AnalyticsSink {
  sink ??= createAnalytics(import.meta.env);

  return sink;
}

export const analytics: AnalyticsSink = {
  page: (path) => {
    active().page(path);
  },
  track: (event, props) => {
    active().track(event, props);
  },
};

export function __setAnalyticsForTests(next: AnalyticsSink | undefined): void {
  sink = next;
}

export function legsBucket(count: number): string {
  return count <= 1 ? "single" : count <= 4 ? "multiple_2_4" : "multiple_5_plus";
}
