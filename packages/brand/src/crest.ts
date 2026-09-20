/**
 * Generated club crests: a shield in the club's kit colours with a diagonal
 * sash and the three-letter code. Deterministic from the inputs, so every
 * client draws the same crest without an asset pipeline.
 */

export const CREST_VIEWBOX = "0 0 48 56";
export const CREST_SHIELD_PATH = "M24 2l20 6v22c0 12-9 20-20 24C13 50 4 42 4 30V8l20-6z";
export const CREST_SASH_PATH = "M4 34L44 12v9L4 43z";
export const CREST_INNER_PATH = "M24 6.5l16 4.8v18.4c0 9.6-7.2 16.3-16 19.7-8.8-3.4-16-10.1-16-19.7V11.3l16-4.8z";

export interface CrestColors {
  readonly primary: string;
  readonly secondary: string;
  readonly onPrimary: string;
}

export function crestSvg(code: string, colors: CrestColors, size = 48): string {
  const h = Math.round((size * 56) / 48);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(h)}" viewBox="${CREST_VIEWBOX}" role="img" aria-label="${code}"><path d="${CREST_SHIELD_PATH}" fill="${colors.secondary}"/><path d="${CREST_INNER_PATH}" fill="${colors.primary}"/><path d="${CREST_SASH_PATH}" fill="${colors.secondary}" opacity="0.85"/><text x="24" y="37" text-anchor="middle" font-family="Archivo, Inter, sans-serif" font-weight="800" font-size="13" fill="${colors.onPrimary}">${code}</text></svg>`;
}
