import type { StateTone } from "@betng/design-tokens";
import type { StandingRow } from "@betng/ui-core";

/** A qualification or relegation band. Drawn only when the platform sends one with the row. */
export interface StandingZone {
  readonly label: string;
  readonly tone?: StateTone;
}

export type ZonedStandingRow = StandingRow & {
  readonly zone?: StandingZone | undefined;
};

export function rowZone(row: StandingRow): StandingZone | undefined {
  return (row as ZonedStandingRow).zone;
}

export function signedDifference(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}
