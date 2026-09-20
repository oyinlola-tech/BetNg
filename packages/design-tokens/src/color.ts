/** BetNG's semantic colour system. */

export interface ColorTheme {
  readonly background: string;
  readonly surface: string;
  readonly surfaceElevated: string;
  readonly surfaceSunken: string;
  readonly surfaceHover: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly textOnBrand: string;
  readonly textOnLive: string;

  readonly border: string;
  readonly borderStrong: string;
  /** Distinct from brand so it reads even on a brand button. */
  readonly focusRing: string;

  readonly brand: string;
  readonly brandHover: string;
  readonly brandActive: string;
  readonly brandSubtle: string;

  readonly success: string;
  readonly successSubtle: string;
  readonly danger: string;
  readonly dangerSubtle: string;
  readonly warning: string;
  readonly warningSubtle: string;
  /** Reserved for in-play state and nothing else. */
  readonly live: string;
  readonly liveSubtle: string;

  readonly overlay: string;
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

export type StateTone =
  "live" | "brand" | "neutral" | "muted" | "success" | "warning";
