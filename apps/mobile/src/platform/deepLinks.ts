export type DeepLinkTarget =
  | { readonly name: "Home" }
  | { readonly name: "Match"; readonly matchId: string }
  | { readonly name: "Results" }
  /* In-app targets only (notification taps); no external link resolves to these. */
  | { readonly name: "Bets" }
  | { readonly name: "Account" }
  | { readonly name: "Wallet" }
  | { readonly name: "Bet"; readonly betId: string }
  | { readonly name: "Payment"; readonly reference: string };

export interface DeepLinkOptions {
  readonly schemes: readonly string[];
  /** Exact https hosts accepted for universal / app links. */
  readonly hosts: readonly string[];
}

export interface ParsedDeepLink {
  readonly target: DeepLinkTarget;
  readonly accepted: boolean;
}

const HOME: DeepLinkTarget = { name: "Home" };
const MAX_URL_LENGTH = 512;
const MAX_PATH_LENGTH = 200;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const REFERENCE = /^[A-Za-z0-9_-]{6,64}$/;
const SCHEME_URL = /^([a-z][a-z0-9+.-]*):\/\/(\/?[^?#]*)(\?[^#]*)?(#.*)?$/i;
const HTTPS_URL = /^https:\/\/([a-z0-9.-]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i;

function rejected(): ParsedDeepLink {
  return { target: HOME, accepted: false };
}

function extractPath(url: string, options: DeepLinkOptions): string | undefined {
  const https = HTTPS_URL.exec(url);

  if (https !== null) {
    const host = (https[1] ?? "").toLowerCase();

    return options.hosts.some((allowed) => allowed.toLowerCase() === host) ? (https[2] ?? "/") : undefined;
  }

  const custom = SCHEME_URL.exec(url);

  if (custom === null) return undefined;

  const scheme = (custom[1] ?? "").toLowerCase();

  if (scheme === "http" || scheme === "https") return undefined;
  if (!options.schemes.some((allowed) => allowed.toLowerCase() === scheme)) return undefined;

  return `/${(custom[2] ?? "").replace(/^\//, "")}`;
}

export function targetForPath(path: string): ParsedDeepLink {
  if (path.length > MAX_PATH_LENGTH || /[%\\]/.test(path)) return rejected();

  const segments = path.split("/").filter((segment) => segment !== "");
  const [route, id, ...rest] = segments;

  if (rest.length > 0) return rejected();

  switch (route?.toLowerCase()) {
    case undefined:
      return { target: HOME, accepted: true };
    case "results":
      return id === undefined ? { target: { name: "Results" }, accepted: true } : rejected();
    case "match":
      return id !== undefined && ID.test(id) ? { target: { name: "Match", matchId: id }, accepted: true } : rejected();
    case "bet":
      return id !== undefined && ID.test(id) ? { target: { name: "Bet", betId: id }, accepted: true } : rejected();
    case "payment":
      return id !== undefined && REFERENCE.test(id) ? { target: { name: "Payment", reference: id }, accepted: true } : rejected();
    default:
      return rejected();
  }
}

/** Only ids travel through a link; the screen it opens reads everything else from the platform. */
export function parseDeepLink(url: unknown, options: DeepLinkOptions): ParsedDeepLink {
  if (typeof url !== "string" || url.length === 0 || url.length > MAX_URL_LENGTH) return rejected();
  if (/[\s@]/.test(url) || [...url].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return rejected();

  const path = extractPath(url, options);

  return path === undefined ? rejected() : targetForPath(path);
}

/** The https host of the public site, when it is configured, for universal links. */
export function hostsFromSiteUrl(siteUrl: string | undefined): readonly string[] {
  const match = siteUrl === undefined ? null : /^https:\/\/([a-z0-9.-]+)(\/.*)?$/i.exec(siteUrl);

  return match?.[1] === undefined ? [] : [match[1].toLowerCase()];
}
