export type HapticEvent = "bet-accepted" | "bet-rejected";

export type VibrationPattern = number | readonly number[];

const PATTERNS: Readonly<Record<HapticEvent, VibrationPattern>> = {
  "bet-accepted": 40,
  "bet-rejected": [0, 60, 90, 60],
};

export function hapticPattern(event: HapticEvent): VibrationPattern {
  return PATTERNS[event];
}

export interface Haptics {
  play(event: HapticEvent): void;
}

/** Plays nothing when the customer turned feedback off; a device without a motor simply ignores the call. */
export function createHaptics(vibrate: (pattern: VibrationPattern) => void, enabled: () => boolean): Haptics {
  return {
    play: (event) => {
      if (!enabled()) return;

      try {
        vibrate(hapticPattern(event));
      } catch {
        return;
      }
    },
  };
}
