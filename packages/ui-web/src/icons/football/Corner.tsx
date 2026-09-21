import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Corner(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="corner" {...props} />;
}
