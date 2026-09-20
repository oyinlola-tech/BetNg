import {
  darkTheme,
  fontSize,
  fontWeight,
  lightTheme,
  radius,
  spacing,
  type ColorTheme,
} from "@betng/design-tokens";
import { Appearance } from "react-native";
import { create } from "zustand";
import { storage } from "../services/storage";

export type ThemePreference = "light" | "dark" | "system";

export interface Theme {
  readonly name: "light" | "dark";
  readonly colors: ColorTheme;
  readonly space: typeof spacing;
  readonly radius: typeof radius;
  readonly text: typeof fontSize;
  readonly weight: typeof fontWeight;
}

const THEME_KEY = "betng.mobile.theme";

function readPreference(): ThemePreference {
  const stored = storage.get(THEME_KEY);

  return stored === "light" || stored === "dark" ? stored : "system";
}

interface ThemeState {
  readonly preference: ThemePreference;
  readonly system: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
  setSystem: (next: "light" | "dark") => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: readPreference(),
  system: Appearance.getColorScheme() === "dark" ? "dark" : "light",
  setPreference: (preference) => {
    storage.set(THEME_KEY, preference);
    set({ preference });
  },
  setSystem: (system) => {
    set({ system });
  },
}));

Appearance.addChangeListener(({ colorScheme }) => {
  useThemeStore.getState().setSystem(colorScheme === "dark" ? "dark" : "light");
});

export function buildTheme(name: "light" | "dark"): Theme {
  return {
    name,
    colors: name === "dark" ? darkTheme : lightTheme,
    space: spacing,
    radius,
    text: fontSize,
    weight: fontWeight,
  };
}

const THEMES = {
  light: buildTheme("light"),
  dark: buildTheme("dark"),
} as const;

export function useTheme(): Theme {
  const preference = useThemeStore((s) => s.preference);
  const system = useThemeStore((s) => s.system);

  return THEMES[preference === "system" ? system : preference];
}
