// Coarse labels for the sessions screen. No IP address or location is derived or stored.

export interface ClientDescription {
  readonly device: string | undefined;
  readonly browser: string | undefined;
  readonly platform: string | undefined;
}

const MAX_INPUT = 512;

const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/EdgA?\/(\d+)/u, "Edge"],
  [/OPR\/(\d+)/u, "Opera"],
  [/SamsungBrowser\/(\d+)/u, "Samsung Internet"],
  [/Firefox\/(\d+)/u, "Firefox"],
  [/FxiOS\/(\d+)/u, "Firefox"],
  [/CriOS\/(\d+)/u, "Chrome"],
  [/Chrome\/(\d+)/u, "Chrome"],
  [/Version\/(\d+)[^ ]* (Mobile\/\S+ )?Safari\//u, "Safari"],
];

const PLATFORMS: readonly (readonly [RegExp, string])[] = [
  [/iPhone|iPad|iPod/u, "iOS"],
  [/Android/u, "Android"],
  [/CrOS/u, "ChromeOS"],
  [/Windows NT/u, "Windows"],
  [/Mac OS X|Macintosh/u, "macOS"],
  [/Linux/u, "Linux"],
];

export function describeClient(userAgent: string | undefined): ClientDescription {
  const ua = (userAgent ?? "").slice(0, MAX_INPUT);

  if (ua.trim() === "") {
    return { device: undefined, browser: undefined, platform: undefined };
  }

  let browser: string | undefined;

  for (const [pattern, name] of BROWSERS) {
    const match = pattern.exec(ua);

    if (match !== null) {
      browser = `${name} ${match[1] ?? ""}`.trim();
      break;
    }
  }

  const platform = PLATFORMS.find(([pattern]) => pattern.test(ua))?.[1];

  const device = /iPad|Tablet/u.test(ua)
    ? "Tablet"
    : /iPhone|Mobile|Android/u.test(ua)
      ? "Phone"
      : platform === undefined
        ? undefined
        : "Computer";

  return { device, browser, platform };
}
