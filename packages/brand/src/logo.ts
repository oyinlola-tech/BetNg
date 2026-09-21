export const LOGO_VIEWBOX = "0 0 64 64";

export const LOGO_TILE_PATH = "M14 0h36c7.7 0 14 6.3 14 14v36c0 7.7-6.3 14-14 14H14C6.3 64 0 57.7 0 50V14C0 6.3 6.3 0 14 0z";

export const LOGO_B_PATH =
  "M18 12h18.5c7.6 0 12.5 4.2 12.5 10.6 0 4.1-2.1 7.1-5.5 8.6 4.6 1.3 7.5 4.9 7.5 9.8C51 48.2 45.6 52 37.6 52H18V12zm9.4 7.6v8.9h7.9c3.3 0 5.2-1.7 5.2-4.5s-1.9-4.4-5.2-4.4h-7.9zm0 16.2v8.6h9.1c3.6 0 5.6-1.7 5.6-4.3s-2-4.3-5.6-4.3h-9.1z";

export const LOGO_CUT_PATH = "M8 44L56 16l2.4 4.2L10.4 48.2z";

export const WORDMARK = { text: "BET", accent: "NG" } as const;

export function logoSvg(options: { readonly tile: string; readonly ink: string; readonly size?: number }): string {
  const size = options.size ?? 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="${LOGO_VIEWBOX}" role="img" aria-label="BETNG"><path d="${LOGO_TILE_PATH}" fill="${options.tile}"/><path d="${LOGO_B_PATH}" fill="${options.ink}"/><path d="${LOGO_CUT_PATH}" fill="${options.tile}" opacity="0.92"/></svg>`;
}
