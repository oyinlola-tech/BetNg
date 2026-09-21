import { create } from "zustand";
import { persist } from "zustand/middleware";
import { configureDateTime } from "@betng/ui-core";
import { getRuntimeConfig } from "../../services/runtime";

export const DATE_LOCALES = [
  { value: "auto", label: "Match my browser" },
  { value: "en-NG", label: "English (Nigeria)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
  { value: "fr-FR", label: "Français (France)" },
] as const;

export type DateLocale = (typeof DATE_LOCALES)[number]["value"];

interface DisplayPreferencesState {
  readonly dateLocale: DateLocale;
  setDateLocale: (dateLocale: DateLocale) => void;
}

/* Display preferences only. Kept on this device; nothing here is account data. */
export const useDisplayPreferences = create<DisplayPreferencesState>()(
  persist(
    (set) => ({
      dateLocale: "auto",
      setDateLocale: (dateLocale) => {
        set({ dateLocale });
        applyDisplayPreferences();
      },
    }),
    { name: "betng.display" },
  ),
);

export function applyDisplayPreferences(): void {
  const { dateLocale } = useDisplayPreferences.getState();
  const timeZone = getRuntimeConfig()?.competitionTimezone;
  const known = DATE_LOCALES.some((option) => option.value === dateLocale);

  configureDateTime({
    ...(dateLocale === "auto" || !known ? {} : { locale: dateLocale }),
    ...(timeZone === undefined ? {} : { competitionTimeZone: timeZone }),
  });
}
