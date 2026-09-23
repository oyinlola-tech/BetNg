import type { FeatureFlag } from "@betng/ui-core";
import { paths } from "../../lib/paths";

export interface NavEntry {
  readonly to: string;
  readonly label: string;
  readonly end?: boolean;
  readonly flag?: FeatureFlag;
}

export const PRIMARY_NAV: readonly NavEntry[] = [
  { to: paths.football, label: "Football" },
  { to: paths.live, label: "Live", flag: "liveEnabled" },
  { to: paths.virtuals, label: "Virtuals", flag: "virtualFootballEnabled" },
  { to: paths.results, label: "Results" },
  { to: paths.standings, label: "Standings" },
];

/** Pages that keep the league as a `?league=` filter; elsewhere a league opens its own page. `all` adds an "All competitions" choice. */
export const LEAGUE_FILTER_PATHS: readonly { readonly path: string; readonly all: boolean }[] = [
  { path: paths.virtuals, all: true },
  { path: paths.results, all: true },
  { path: paths.standings, all: false },
];
