import { beforeEach, describe, expect, it } from "vitest";
import { brightnessAt } from "../../src/lib/ambient";
import { cycle, DEFAULT_SETTINGS, getSettings, parseSettings, reloadSettings, updateSettings } from "../../src/lib/displaySettings";
import { getFavourites, parseFavourites, reloadFavourites, toggleFavourite } from "../../src/lib/favourites";

beforeEach(() => {
  localStorage.clear();
  reloadSettings();
  reloadFavourites();
});

describe("TV display settings", () => {
  it("falls back field by field on malformed storage", () => {
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ audioEnabled: "yes", volume: 99, autoSwitchCooldownSec: 7, dim: { start: "25:00", brightness: 0.6, enabled: true } }))).toEqual({
      ...DEFAULT_SETTINGS,
      volume: 10,
      dim: { ...DEFAULT_SETTINGS.dim, enabled: true },
    });
  });

  it("persists on the device", () => {
    updateSettings((s) => ({ ...s, quietMode: true, volume: 3 }));
    reloadSettings();
    expect(getSettings()).toMatchObject({ quietMode: true, volume: 3 });
  });

  it("cycles through options", () => {
    expect(cycle([30, 60, 120], 120)).toBe(30);
    expect(cycle([30, 60, 120], 45)).toBe(30);
  });

  it("dims on a schedule, including one that runs overnight", () => {
    const night = { enabled: true, start: "23:00", end: "07:00", brightness: 0.4 };

    expect(brightnessAt(new Date(2026, 8, 22, 23, 30), night)).toBe(0.4);
    expect(brightnessAt(new Date(2026, 8, 22, 6, 59), night)).toBe(0.4);
    expect(brightnessAt(new Date(2026, 8, 22, 7, 0), night)).toBe(1);
    expect(brightnessAt(new Date(2026, 8, 22, 14, 0), { ...night, start: "13:00", end: "15:00" })).toBe(0.4);
    expect(brightnessAt(new Date(2026, 8, 22, 23, 30), { ...night, enabled: false })).toBe(1);
  });
});

describe("TV favourites", () => {
  it("are stored locally and validated on read", () => {
    toggleFavourite("5b8f1c2e-0000-4000-8000-000000000001");
    reloadFavourites();
    expect([...getFavourites()]).toEqual(["5b8f1c2e-0000-4000-8000-000000000001"]);
    toggleFavourite("5b8f1c2e-0000-4000-8000-000000000001");
    expect(getFavourites().size).toBe(0);
    expect([...parseFavourites(JSON.stringify(["ok-id", 4, "<script>", "x".repeat(80)]))]).toEqual(["ok-id"]);
    expect(parseFavourites("{}").size).toBe(0);
  });
});
