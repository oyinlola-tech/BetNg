export type MatchCardVariant =
  | "compact"
  | "standard"
  | "featured"
  | "live"
  | "mobile"
  | "shop"
  | "tv";

export interface MatchCardVariantSpec {
  readonly layout: "row" | "stack";
  readonly crest: 20 | 24 | 32 | 48 | 96;
  readonly root: string;
  readonly main: string;
  readonly markets: string;
  readonly name: string;
  readonly score: string;
  readonly teamGap: string;
  readonly badge: "sm" | "md";
}

const CARD = "rounded-md border border-border bg-surface";

export const MATCH_CARD_VARIANTS: Readonly<
  Record<MatchCardVariant, MatchCardVariantSpec>
> = {
  compact: {
    layout: "row",
    crest: 20,
    root: "rounded-sm",
    main: "px-3 py-2.5",
    markets: "py-2.5 pr-3",
    name: "type-body",
    score: "text-2xl",
    teamGap: "space-y-1",
    badge: "sm",
  },
  shop: {
    layout: "row",
    crest: 20,
    root: "border-b border-border",
    main: "px-2 py-1.5",
    markets: "py-1.5 pr-2",
    name: "type-body",
    score: "text-xl",
    teamGap: "space-y-0.5",
    badge: "sm",
  },
  mobile: {
    layout: "stack",
    crest: 24,
    root: CARD,
    main: "p-3",
    markets: "px-3 pb-3",
    name: "type-body",
    score: "text-xl",
    teamGap: "space-y-1.5",
    badge: "sm",
  },
  standard: {
    layout: "stack",
    crest: 32,
    root: CARD,
    main: "p-4",
    markets: "px-4 pb-4",
    name: "type-body",
    score: "text-3xl",
    teamGap: "space-y-2",
    badge: "sm",
  },
  live: {
    layout: "stack",
    crest: 32,
    root: CARD,
    main: "p-4",
    markets: "px-4 pb-4",
    name: "type-body",
    score: "text-3xl",
    teamGap: "space-y-2",
    badge: "sm",
  },
  featured: {
    layout: "stack",
    crest: 48,
    root: `${CARD} shadow-sm`,
    main: "p-6",
    markets: "px-6 pb-6",
    name: "type-h3",
    score: "text-4xl",
    teamGap: "space-y-3",
    badge: "md",
  },
  tv: {
    layout: "stack",
    crest: 96,
    root: CARD,
    main: "p-8",
    markets: "px-8 pb-8",
    name: "type-h1",
    score: "text-6xl",
    teamGap: "space-y-5",
    badge: "md",
  },
};
