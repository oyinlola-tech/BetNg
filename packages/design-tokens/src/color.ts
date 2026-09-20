/**
 * BetNG's semantic colour system.
 *
 * Two themes, one vocabulary. A component never names a hex value; it names
 * a role — `surface`, `textMuted`, `live` — and the theme decides what that
 * role looks like. Dark mode is therefore its own designed palette rather
 * than an inversion of light: surfaces step *up* in lightness as they rise
 * off the page, borders are lifted rather than darkened, and the accent is
 * re-tuned so it keeps the same perceived weight on a dark ground.
 *
 * The palette is deliberately small. One brand accent (cobalt), one live
 * red, and the three status colours every sports product needs. Most of
 * the interface is neutral; the accent is for selection and action, the
 * live red for exactly one thing.
 */

export interface ColorTheme {
  /** The page. */
  readonly background: string;
  /** A panel resting on the page. */
  readonly surface: string;
  /** A panel raised above other panels: menus, sheets, dialogs. */
  readonly surfaceElevated: string;
  /** A recessed well inside a surface: odds buttons, inputs, table stripes. */
  readonly surfaceSunken: string;
  /** Tinted surface for a hover or selected row. */
  readonly surfaceHover: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  /** Text placed on a brand-coloured surface. */
  readonly textOnBrand: string;
  /** Text placed on a live-coloured surface. */
  readonly textOnLive: string;

  readonly border: string;
  readonly borderStrong: string;
  /** The focus ring. Distinct from brand so it reads even on a brand button. */
  readonly focusRing: string;

  readonly brand: string;
  readonly brandHover: string;
  readonly brandActive: string;
  /** A wash of brand for selected backgrounds and highlighted rows. */
  readonly brandSubtle: string;

  readonly success: string;
  readonly successSubtle: string;
  readonly danger: string;
  readonly dangerSubtle: string;
  readonly warning: string;
  readonly warningSubtle: string;
  /** The live indicator. Reserved for in-play state and nothing else. */
  readonly live: string;
  readonly liveSubtle: string;

  /** Scrim behind a modal or sheet. */
  readonly overlay: string;
  /** The skeleton shimmer base. */
  readonly skeleton: string;
}

export const lightTheme: ColorTheme = Object.freeze({
  background: "#F4F5F7",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceSunken: "#EDEFF3",
  surfaceHover: "#F7F8FA",

  textPrimary: "#0E1218",
  textSecondary: "#465060",
  textMuted: "#78828F",
  textOnBrand: "#FFFFFF",
  textOnLive: "#FFFFFF",

  border: "#E2E5EA",
  borderStrong: "#C9CED6",
  focusRing: "#2457F5",

  brand: "#2457F5",
  brandHover: "#1D48CF",
  brandActive: "#173BAA",
  brandSubtle: "#EAF0FF",

  success: "#12805C",
  successSubtle: "#E6F5EF",
  danger: "#C92A2A",
  dangerSubtle: "#FBEAEA",
  warning: "#B25E09",
  warningSubtle: "#FDF1E2",
  live: "#E3142E",
  liveSubtle: "#FDE9EC",

  overlay: "rgba(14, 18, 24, 0.48)",
  skeleton: "#E8EAEE",
});

export const darkTheme: ColorTheme = Object.freeze({
  background: "#0A0C10",
  surface: "#12151B",
  surfaceElevated: "#191D25",
  surfaceSunken: "#0D1015",
  surfaceHover: "#1A1F28",

  textPrimary: "#F2F4F7",
  textSecondary: "#B2BAC6",
  textMuted: "#7B8595",
  textOnBrand: "#FFFFFF",
  textOnLive: "#FFFFFF",

  border: "#222732",
  borderStrong: "#323946",
  focusRing: "#7FA1FF",

  brand: "#4C7DFF",
  brandHover: "#6B93FF",
  brandActive: "#3A69EB",
  brandSubtle: "#16233F",

  success: "#2FBF83",
  successSubtle: "#0F2A21",
  danger: "#F26D6D",
  dangerSubtle: "#341418",
  warning: "#F0B441",
  warningSubtle: "#332611",
  live: "#FF3D52",
  liveSubtle: "#3A1219",

  overlay: "rgba(0, 0, 0, 0.62)",
  skeleton: "#1E232C",
});

export type ThemeName = "light" | "dark";

export const themes: Readonly<Record<ThemeName, ColorTheme>> = Object.freeze({
  light: lightTheme,
  dark: darkTheme,
});

/**
 * The colour a match state is drawn in, by role rather than by value.
 *
 * Shared by all three clients so a "live" badge means the same thing on a
 * phone, a desktop and a television.
 */
export type StateTone = "live" | "brand" | "neutral" | "muted" | "success" | "warning";
