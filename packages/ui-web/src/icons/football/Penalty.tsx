import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Penalty(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="penalty" {...props} />;
}
