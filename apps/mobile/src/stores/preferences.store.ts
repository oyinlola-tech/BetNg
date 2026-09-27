import { create } from "zustand";
import { storage } from "../services/storage";

const HAPTICS_KEY = "betng.pref.haptics";
const ONBOARDED_KEY = "betng.pref.onboarded";

interface DevicePreferences {
  readonly haptics: boolean;
  readonly onboarded: boolean;
  setHaptics: (on: boolean) => void;
  completeOnboarding: () => void;
}

export const useDevicePreferences = create<DevicePreferences>()((set) => ({
  haptics: storage.get(HAPTICS_KEY) !== "off",
  onboarded: storage.get(ONBOARDED_KEY) === "yes",
  setHaptics: (on) => {
    storage.set(HAPTICS_KEY, on ? "on" : "off");
    set({ haptics: on });
  },
  completeOnboarding: () => {
    storage.set(ONBOARDED_KEY, "yes");
    set({ onboarded: true });
  },
}));

export function hydrateDevicePreferences(): void {
  useDevicePreferences.setState({
    haptics: storage.get(HAPTICS_KEY) !== "off",
    onboarded: storage.get(ONBOARDED_KEY) === "yes",
  });
}
