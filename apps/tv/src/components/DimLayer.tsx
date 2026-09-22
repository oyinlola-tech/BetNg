import { useNow } from "../hooks/useNow";
import { brightnessAt } from "../lib/ambient";
import { useDisplaySettings } from "../lib/displaySettings";

export function DimLayer(): React.JSX.Element | null {
  const [settings] = useDisplaySettings();
  const now = useNow(30_000);
  const brightness = brightnessAt(new Date(now), settings.dim);

  if (brightness >= 1) return null;

  return <div aria-hidden data-dim={brightness} className="pointer-events-none fixed inset-0 z-[70] bg-black transition-opacity duration-[var(--bn-duration-slow)]" style={{ opacity: 1 - brightness }} />;
}
