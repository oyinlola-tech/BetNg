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
  readonly live: string;
  readonly liveSubtle: string;

  readonly overlay: string;
  readonly skeleton: string;

  /** Chart series, assigned in this order and never cycled. Validated for colour-vision separation on each theme's surface. */
  readonly series1: string;
  readonly series2: string;
  readonly series3: string;
}

export const lightTheme: ColorTheme = Object.freeze({
  background: "#F5F3EE",
  surface: "#FDFCFA",
  surfaceElevated: "#FFFFFF",
  surfaceSunken: "#ECE9E2",
  surfaceHover: "#F7F5F0",

  textPrimary: "#14130F",
  textSecondary: "#4B4840",
  textMuted: "#726D62",
  textOnBrand: "#FFFFFF",
  textOnLive: "#FFFFFF",

  border: "#E3DFD6",
  borderStrong: "#CBC5B8",
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
  info: "#0B6B94",
  infoSubtle: "#E4F1F7",
  live: "#E3142E",
  liveSubtle: "#FDE9EC",
  pending: "#5A6170",
  pendingSubtle: "#ECEDF0",
  void: "#6E6A62",
  voidSubtle: "#ECE9E2",
  suspended: "#A4480F",
  suspendedSubtle: "#FBEDE3",

  overlay: "rgba(20, 19, 15, 0.5)",
  skeleton: "#E9E5DD",

  series1: "#2457F5",
  series2: "#EB6834",
  series3: "#1BAF7A",
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
  info: "#4FB3DE",
  infoSubtle: "#0F2733",
  live: "#FF3D52",
  liveSubtle: "#3A1219",
  pending: "#9AA3B2",
  pendingSubtle: "#1C2029",
  void: "#8D8A84",
  voidSubtle: "#1D1E21",
  suspended: "#F08A4B",
  suspendedSubtle: "#33200F",

  overlay: "rgba(0, 0, 0, 0.62)",
  skeleton: "#1E232C",

  series1: "#4C7DFF",
  series2: "#D95926",
  series3: "#199E70",
});

export type ThemeName = "light" | "dark";

export const themes: Readonly<Record<ThemeName, ColorTheme>> = Object.freeze({
  light: lightTheme,
  dark: darkTheme,
});

export type StateTone =
  | "live"
  | "brand"
  | "neutral"
  | "muted"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "pending"
  | "void"
  | "suspended";
