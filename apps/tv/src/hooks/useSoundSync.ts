import { useEffect } from "react";
import { soundEngine } from "../lib/audio";
import { useDisplaySettings } from "../lib/displaySettings";

export function useSoundSync(): void {
  const [settings] = useDisplaySettings();

  useEffect(() => {
    soundEngine.configure({ enabled: settings.audioEnabled, volume: settings.volume, ambient: !settings.quietMode });
  }, [settings.audioEnabled, settings.volume, settings.quietMode]);

  useEffect(() => {
    const onVisibility = (): void => {
      soundEngine.setHidden(document.hidden);
    };
    const onKey = (): void => {
      soundEngine.resume();
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);
}
