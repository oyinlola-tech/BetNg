const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const INK = "#14130F";
export const PAPER = "#FFFFFF";

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

function channels(hex: string): readonly [number, number, number] {
  const h = hex.length === 4 ? `#${hex[1] ?? "0"}${hex[1] ?? "0"}${hex[2] ?? "0"}${hex[2] ?? "0"}${hex[3] ?? "0"}${hex[3] ?? "0"}` : hex;
  const n = Number.parseInt(h.slice(1), 16);

  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function mix(a: string, b: string, amount: number): string {
  const ca = channels(a);
  const cb = channels(b);
  const out = ca.map((c, i) => Math.round(c + ((cb[i] ?? c) - c) * amount));

  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function readableOn(background: string): string {
  return luminance(background) > 0.4 ? INK : PAPER;
}
