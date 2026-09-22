import { create } from "zustand";
import { storage } from "../services/storage";

const HAPTICS_KEY = "betng.pref.haptics";

interface DevicePreferences {
  readonly haptics: boolean;
  setHaptics: (on: boolean) => void;
}

export const useDevicePreferences = create<DevicePreferences>()((set) => ({
  haptics: storage.get(HAPTICS_KEY) !== "off",
  setHaptics: (on) => {
    storage.set(HAPTICS_KEY, on ? "on" : "off");
    set({ haptics: on });
  },
}));

export function hydrateDevicePreferences(): void {
  useDevicePreferences.setState({ haptics: storage.get(HAPTICS_KEY) !== "off" });
}
