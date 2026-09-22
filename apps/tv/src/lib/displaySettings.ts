import { useCallback, useSyncExternalStore } from "react";

export interface DimSchedule {
  readonly enabled: boolean;
  readonly start: string;
  readonly end: string;
  readonly brightness: number;
}

export interface DisplaySettings {
  readonly audioEnabled: boolean;
  readonly volume: number;
  readonly quietMode: boolean;
  readonly autoSwitchOnGoal: boolean;
  readonly autoSwitchCooldownSec: number;
  readonly ambientAfterMin: number;
  readonly dim: DimSchedule;
}

export const VOLUME_MAX = 10;
export const COOLDOWN_OPTIONS = [30, 60, 120, 300] as const;
export const AMBIENT_OPTIONS = [0, 5, 10, 20, 30] as const;
export const BRIGHTNESS_OPTIONS = [0.4, 0.6, 0.8] as const;

export const DEFAULT_SETTINGS: DisplaySettings = {
  audioEnabled: false,
  volume: 5,
  quietMode: false,
  autoSwitchOnGoal: true,
  autoSwitchCooldownSec: 60,
  ambientAfterMin: 10,
  dim: { enabled: false, start: "23:00", end: "07:00", brightness: 0.6 },
};

const KEY = "betng.tv.settings";
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/* Storage is outside the app's control: anything malformed falls back to the default, field by field. */
export function parseSettings(raw: string | null): DisplaySettings {
  if (raw === null || raw.length > 2048) return DEFAULT_SETTINGS;

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (typeof value !== "object" || value === null) return DEFAULT_SETTINGS;

  const v = value as Record<string, unknown>;
  const dim = (typeof v["dim"] === "object" && v["dim"] !== null ? v["dim"] : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const volume = typeof v["volume"] === "number" && Number.isInteger(v["volume"]) ? Math.min(VOLUME_MAX, Math.max(0, v["volume"])) : d.volume;

  return {
    audioEnabled: bool(v["audioEnabled"], d.audioEnabled),
    volume,
    quietMode: bool(v["quietMode"], d.quietMode),
    autoSwitchOnGoal: bool(v["autoSwitchOnGoal"], d.autoSwitchOnGoal),
    autoSwitchCooldownSec: pick(v["autoSwitchCooldownSec"], COOLDOWN_OPTIONS, d.autoSwitchCooldownSec as (typeof COOLDOWN_OPTIONS)[number]),
    ambientAfterMin: pick(v["ambientAfterMin"], AMBIENT_OPTIONS, d.ambientAfterMin as (typeof AMBIENT_OPTIONS)[number]),
    dim: {
      enabled: bool(dim["enabled"], d.dim.enabled),
      start: typeof dim["start"] === "string" && HM.test(dim["start"]) ? dim["start"] : d.dim.start,
      end: typeof dim["end"] === "string" && HM.test(dim["end"]) ? dim["end"] : d.dim.end,
      brightness: pick(dim["brightness"], BRIGHTNESS_OPTIONS, d.dim.brightness as (typeof BRIGHTNESS_OPTIONS)[number]),
    },
  };
}

const listeners = new Set<() => void>();
let current: DisplaySettings | undefined;

export function getSettings(): DisplaySettings {
  if (current === undefined) {
    let raw: string | null;

    try {
      raw = localStorage.getItem(KEY);
    } catch {
      raw = null;
    }
    current = parseSettings(raw);
  }

  return current;
}

export function updateSettings(change: (current: DisplaySettings) => DisplaySettings): void {
  const next = parseSettings(JSON.stringify(change(getSettings())));

  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
  }
  for (const l of listeners) l();
}

export function reloadSettings(): void {
  current = undefined;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useDisplaySettings(): readonly [DisplaySettings, (change: (current: DisplaySettings) => DisplaySettings) => void] {
  const settings = useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
  const update = useCallback((change: (current: DisplaySettings) => DisplaySettings) => {
    updateSettings(change);
  }, []);

  return [settings, update];
}

export function cycle<T>(options: readonly T[], current: T, step = 1): T {
  const index = options.indexOf(current);
  const next = (index + step + options.length) % options.length;

  return options[index === -1 ? 0 : next] as T;
}
