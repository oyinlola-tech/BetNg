import { LOGO_B_PATH, LOGO_CUT_PATH, LOGO_TILE_PATH, LOGO_VIEWBOX, WORDMARK } from "@betng/brand";
import { cn } from "../lib/cn";

export interface BrandLogoProps {
  readonly size?: number;
  /** A product suffix such as "Shop" or "Admin", set beside the wordmark. */
  readonly product?: string;
  readonly markOnly?: boolean;
  readonly className?: string;
}

export function BrandLogo({ size = 28, product, markOnly = false, className }: BrandLogoProps): React.JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox={LOGO_VIEWBOX} role="img" aria-label="BetNG" className="shrink-0">
        <path d={LOGO_TILE_PATH} fill="var(--bn-brand)" />
        <path d={LOGO_B_PATH} fill="var(--bn-text-on-brand)" />
        <path d={LOGO_CUT_PATH} fill="var(--bn-brand)" opacity={0.92} />
      </svg>
      {!markOnly && (
        <span className="font-display text-lg font-bold leading-none tracking-tight text-text-primary" aria-hidden>
          {WORDMARK.text}
          <span className="text-brand">{WORDMARK.accent}</span>
          {product !== undefined && <span className="ml-1.5 align-middle text-xs font-semibold uppercase tracking-caps text-text-muted">{product}</span>}
        </span>
      )}
    </span>
  );
}
