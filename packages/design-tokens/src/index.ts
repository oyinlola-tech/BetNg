/**
 * @betng/design-tokens
 *
 * The one description of how BetNG looks, consumed by three clients that
 * lay it out differently. Web and TV read `css/tokens.css`, which is
 * generated from these values; mobile reads the values directly.
 */

export { darkTheme, lightTheme, themes } from "./color.js";
export type { ColorTheme, StateTone, ThemeName } from "./color.js";

export {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  tvScale,
} from "./typography.js";

export {
  breakpoint,
  minTouchTarget,
  radius,
  shadow,
  spacing,
  zIndex,
} from "./layout.js";

export { duration, easing } from "./motion.js";

export { renderCss } from "./css.js";
