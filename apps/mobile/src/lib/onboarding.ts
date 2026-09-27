export type OnboardingArt = "centre" | "box" | "corner";

export interface OnboardingPage {
  readonly key: string;
  readonly art: OnboardingArt;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
}

export const ONBOARDING_PAGES: readonly OnboardingPage[] = [
  {
    key: "matches",
    art: "centre",
    eyebrow: "Virtual football",
    title: "A match is always about to kick off",
    body: "Simulated leagues run around the clock, with fixtures, standings and results in one place.",
  },
  {
    key: "live",
    art: "box",
    eyebrow: "Live",
    title: "Follow every minute",
    body: "Goals, cards and substitutions arrive as they happen, with the score and match stats beside them.",
  },
  {
    key: "slip",
    art: "corner",
    eyebrow: "Bet slip",
    title: "Build a slip in a few taps",
    body: "Pick your outcomes, set a stake and follow each bet from kick-off to settlement.",
  },
];

/** The page a horizontal scroll offset has settled on; a pager not yet measured is on its first page. */
export function pageForOffset(offset: number, width: number, count: number): number {
  if (width <= 0 || count <= 0 || !Number.isFinite(offset)) return 0;

  return Math.min(count - 1, Math.max(0, Math.round(offset / width)));
}
