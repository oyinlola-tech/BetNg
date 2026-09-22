import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSoundEngine, crowdIntensity, cueFor } from "../../src/lib/audio";
import { DEFAULT_SETTINGS, getSettings, reloadSettings } from "../../src/lib/displaySettings";
import { event } from "../fakes/platform";

function fakeContext(): AudioContext {
  const param = (): AudioParam => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() }) as unknown as AudioParam;
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = { gain: param(), frequency: param(), Q: param(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };

    n["connect"] = vi.fn((target: unknown) => target);

    return n;
  };

  return {
    state: "running",
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain: vi.fn(node),
    createOscillator: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createBufferSource: vi.fn(node),
    createBuffer: vi.fn((_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) })),
    resume: vi.fn(async () => undefined),
    suspend: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  } as unknown as AudioContext;
}

beforeEach(() => {
  localStorage.clear();
  reloadSettings();
});

describe("TV sound", () => {
  it("is off by default on a fresh display", () => {
    expect(DEFAULT_SETTINGS.audioEnabled).toBe(false);
    expect(getSettings().audioEnabled).toBe(false);
  });

  it("creates no audio context until sound is switched on", () => {
    const create = vi.fn(fakeContext);
    const engine = createSoundEngine(create);

    engine.configure({ enabled: false, volume: 5, ambient: true });
    engine.play("goal");
    engine.setIntensity(1);
    expect(create).not.toHaveBeenCalled();
    expect(engine.active()).toBe(false);

    engine.configure({ enabled: true, volume: 5, ambient: true });
    engine.play("goal");
    expect(create).toHaveBeenCalledTimes(1);
    expect(engine.active()).toBe(true);
  });

  it("is silent and suspended while the tab is hidden", () => {
    const ctx = fakeContext();
    const engine = createSoundEngine(() => ctx);

    engine.configure({ enabled: true, volume: 5, ambient: false });
    engine.setHidden(true);
    const oscillators = (ctx.createOscillator as ReturnType<typeof vi.fn>).mock.calls.length;

    engine.play("whistle");
    expect((ctx.createOscillator as ReturnType<typeof vi.fn>).mock.calls.length).toBe(oscillators);
    expect(ctx.suspend).toHaveBeenCalled();
  });

  it("derives crowd intensity from recent platform events only", () => {
    const calm = crowdIntensity([event("FOUL", 40, { home: 0, away: 0 })]);
    const goal = crowdIntensity([event("GOAL", 40, { home: 1, away: 0 })]);
    const old = crowdIntensity([event("GOAL", 10, { home: 1, away: 0 }), event("FOUL", 40, { home: 1, away: 0 })]);

    expect(calm).toBeCloseTo(0.15);
    expect(goal).toBeGreaterThan(0.6);
    expect(old).toBeCloseTo(0.15);
  });

  it("keeps only goal and full-time cues in quiet mode", () => {
    expect(cueFor(event("GOAL", 1, { home: 1, away: 0 }), true)).toBe("goal");
    expect(cueFor(event("FULL_TIME", 90, { home: 1, away: 0 }), true)).toBe("final-whistle");
    expect(cueFor(event("HALF_TIME", 45, { home: 1, away: 0 }), true)).toBeUndefined();
    expect(cueFor(event("HALF_TIME", 45, { home: 1, away: 0 }), false)).toBe("whistle");
  });
});
