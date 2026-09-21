import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Stadium(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="stadium" {...props} />;
}
