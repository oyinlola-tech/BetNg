import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Football(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="football" {...props} />;
}
