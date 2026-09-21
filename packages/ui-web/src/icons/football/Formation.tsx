import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Formation(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="formation" {...props} />;
}
