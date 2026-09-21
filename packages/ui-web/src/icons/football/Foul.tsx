import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Foul(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="foul" {...props} />;
}
