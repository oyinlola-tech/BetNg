import type { MarketKind, MarketView, SelectionView } from "@betng/ui-core";
import { CorrectScoreMarket } from "./CorrectScoreMarket";
import { MarketCard } from "./MarketCard";

/*
 * The platform owns the catalogue, so the frontend must not need a release to
 * show a market it has never seen. Every market renders through this registry:
 * a kind with a layout of its own gets it, and anything else gets the generic
 * card, which lays itself out from the market's own column count and
 * selections. An unknown kind is therefore a market that looks plain, never a
 * blank panel and never a crash.
 */

export type MarketDensity = "comfortable" | "compact" | "dense";

export interface MarketRendererProps {
  readonly market: MarketView;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggle: (market: MarketView, selection: SelectionView) => void;
  readonly matchLabel?: string | undefined;
  readonly now?: number | undefined;
  readonly density?: MarketDensity;
  /** Inside another surface: no border or background of its own. */
  readonly flush?: boolean;
  readonly className?: string | undefined;
}

export type MarketRenderer = (
  props: MarketRendererProps,
) => React.JSX.Element;

export function GenericMarket({
  market,
  selectedIds,
  onToggle,
  matchLabel,
  now,
  flush,
  className,
}: MarketRendererProps): React.JSX.Element {
  return (
    <MarketCard
      market={market}
      selectedIds={selectedIds}
      onToggle={onToggle}
      matchLabel={matchLabel}
      now={now}
      flush={flush ?? false}
      className={className}
    />
  );
}

const RENDERERS = new Map<MarketKind, MarketRenderer>([
  ["CORRECT_SCORE", CorrectScoreMarket],
  ["HALF_TIME_CORRECT_SCORE", CorrectScoreMarket],
]);

/** Gives a market kind a layout of its own. Later registrations win. */
export function registerMarketRenderer(
  kind: MarketKind,
  renderer: MarketRenderer,
): void {
  RENDERERS.set(kind, renderer);
}

export function marketRenderer(kind: MarketKind): MarketRenderer {
  return RENDERERS.get(kind) ?? GenericMarket;
}

export function hasMarketRenderer(kind: MarketKind): boolean {
  return RENDERERS.has(kind);
}

/** Renders one market through whichever renderer its kind resolves to. */
export function Market(props: MarketRendererProps): React.JSX.Element {
  const Renderer = marketRenderer(props.market.kind);

  return <Renderer {...props} />;
}
