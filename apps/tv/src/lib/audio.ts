import type { MatchEventView } from "@betng/ui-core";
import { isGoal } from "./commentary";
import { VOLUME_MAX } from "./displaySettings";

export type Cue = "goal" | "whistle" | "final-whistle";

const WINDOW_MINUTES = 5;
const WEIGHTS: Partial<Record<MatchEventView["kind"], number>> = {
  GOAL: 0.5,
  OWN_GOAL: 0.5,
  PENALTY_GOAL: 0.5,
  PENALTY_MISSED: 0.3,
  RED_CARD: 0.25,
  VAR: 0.15,
  YELLOW_CARD: 0.1,
  SHOT: 0.08,
  CORNER: 0.08,
  FREE_KICK: 0.06,
};

/* Crowd level from the platform timeline: what happened in the last five match minutes, fading with distance. */
export function crowdIntensity(events: readonly MatchEventView[]): number {
  const latest = events.reduce((max, e) => Math.max(max, e.minute), 0);
  let level = 0.15;

  for (const e of events) {
    const age = latest - e.minute;

    if (age > WINDOW_MINUTES) continue;
    level += (WEIGHTS[e.kind] ?? 0) * (1 - age / (WINDOW_MINUTES + 1));
  }

  return Math.min(1, Math.max(0.1, level));
}

export function cueFor(event: MatchEventView, quiet: boolean): Cue | undefined {
  if (isGoal(event.kind)) return "goal";
  if (event.kind === "FULL_TIME") return "final-whistle";
  if (quiet) return undefined;
  if (event.kind === "KICK_OFF" || event.kind === "HALF_TIME" || event.kind === "SECOND_HALF") return "whistle";

  return undefined;
}

export interface SoundEngine {
  readonly configure: (options: { readonly enabled: boolean; readonly volume: number; readonly ambient: boolean }) => void;
  readonly setIntensity: (level: number) => void;
  readonly setHidden: (hidden: boolean) => void;
  readonly play: (cue: Cue) => void;
  readonly resume: () => void;
  readonly dispose: () => void;
  readonly active: () => boolean;
}

/* Everything is synthesised; no audio file is fetched. No context exists until sound is switched on. */
export function createSoundEngine(createContext: () => AudioContext | undefined): SoundEngine {
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined;
  let crowd: GainNode | undefined;
  let crowdSource: AudioBufferSourceNode | undefined;
  let noise: AudioBuffer | undefined;
  let enabled = false;
  let ambient = true;
  let volume = 5;
  let hidden = false;
  let intensity = 0.15;

  const level = (): number => (enabled && !hidden ? (volume / VOLUME_MAX) * 0.6 : 0);

  function context(): AudioContext | undefined {
    if (!enabled) return undefined;
    if (ctx !== undefined) return ctx;

    try {
      ctx = createContext();
    } catch {
      ctx = undefined;
    }
    if (ctx === undefined) return undefined;

    master = ctx.createGain();
    master.gain.value = level();
    master.connect(ctx.destination);

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 7;

    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }

    return ctx;
  }

  function applyLevels(): void {
    if (ctx === undefined || master === undefined) return;

    const t = ctx.currentTime;

    master.gain.setTargetAtTime(level(), t, 0.05);
    crowd?.gain.setTargetAtTime(ambient ? 0.04 + 0.22 * intensity : 0, t, 0.8);
  }

  function startCrowd(): void {
    const c = context();

    if (c === undefined || master === undefined || noise === undefined || crowdSource !== undefined || !ambient) return;

    const filter = c.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.value = 650;
    crowd = c.createGain();
    crowd.gain.value = 0;
    crowdSource = c.createBufferSource();
    crowdSource.buffer = noise;
    crowdSource.loop = true;
    crowdSource.connect(filter).connect(crowd).connect(master);
    crowdSource.start();
    applyLevels();
  }

  function stopCrowd(): void {
    try {
      crowdSource?.stop();
    } catch {
    }
    crowdSource?.disconnect();
    crowdSource = undefined;
    crowd = undefined;
  }

  function whistle(c: AudioContext, out: AudioNode, at: number, length: number): void {
    const osc = c.createOscillator();
    const trill = c.createOscillator();
    const depth = c.createGain();
    const env = c.createGain();

    osc.frequency.value = 2900;
    trill.frequency.value = 32;
    depth.gain.value = 140;
    trill.connect(depth).connect(osc.frequency);
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.28, at + 0.02);
    env.gain.setValueAtTime(0.28, at + length - 0.05);
    env.gain.linearRampToValueAtTime(0, at + length);
    osc.connect(env).connect(out);
    osc.start(at);
    trill.start(at);
    osc.stop(at + length + 0.02);
    trill.stop(at + length + 0.02);
  }

  function roar(c: AudioContext, out: AudioNode, at: number): void {
    if (noise === undefined) return;

    const source = c.createBufferSource();
    const band = c.createBiquadFilter();
    const env = c.createGain();

    source.buffer = noise;
    source.loop = true;
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.6;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.9, at + 0.45);
    env.gain.setTargetAtTime(0, at + 1.2, 0.9);
    source.connect(band).connect(env).connect(out);
    source.start(at);
    source.stop(at + 4.5);

    for (const [freq, offset] of [[220, 0], [277.2, 0.02], [329.6, 0.04]] as const) {
      const horn = c.createOscillator();
      const tone = c.createBiquadFilter();
      const hEnv = c.createGain();

      horn.type = "sawtooth";
      horn.frequency.value = freq;
      tone.type = "lowpass";
      tone.frequency.value = 1400;
      hEnv.gain.setValueAtTime(0, at + offset);
      hEnv.gain.linearRampToValueAtTime(0.07, at + offset + 0.05);
      hEnv.gain.setTargetAtTime(0, at + 0.9, 0.2);
      horn.connect(tone).connect(hEnv).connect(out);
      horn.start(at + offset);
      horn.stop(at + 2);
    }
  }

  return {
    configure: (options) => {
      enabled = options.enabled;
      volume = Math.min(VOLUME_MAX, Math.max(0, Math.round(options.volume)));
      ambient = options.ambient;

      if (!enabled) {
        stopCrowd();
        applyLevels();
        if (ctx?.state === "running") void ctx.suspend().catch(() => undefined);

        return;
      }

      const c = context();

      if (c !== undefined && !hidden && c.state === "suspended") void c.resume().catch(() => undefined);
      if (ambient) startCrowd();
      else stopCrowd();
      applyLevels();
    },
    setIntensity: (next) => {
      intensity = Math.min(1, Math.max(0, next));
      applyLevels();
    },
    setHidden: (next) => {
      hidden = next;
      applyLevels();
      if (ctx === undefined) return;
      if (hidden) void ctx.suspend().catch(() => undefined);
      else if (enabled) void ctx.resume().catch(() => undefined);
    },
    play: (cue) => {
      if (hidden) return;

      const c = context();

      if (c === undefined || master === undefined) return;

      const at = c.currentTime + 0.02;

      if (cue === "goal") roar(c, master, at);
      else if (cue === "whistle") whistle(c, master, at, 0.45);
      else {
        whistle(c, master, at, 0.35);
        whistle(c, master, at + 0.5, 0.35);
        whistle(c, master, at + 1, 0.9);
      }
    },
    resume: () => {
      if (enabled && !hidden && ctx?.state === "suspended") void ctx.resume().catch(() => undefined);
    },
    dispose: () => {
      stopCrowd();
      void ctx?.close().catch(() => undefined);
      ctx = undefined;
      master = undefined;
    },
    active: () => ctx !== undefined,
  };
}

export const soundEngine = createSoundEngine(() => {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;

  return Ctor === undefined ? undefined : new Ctor();
});
