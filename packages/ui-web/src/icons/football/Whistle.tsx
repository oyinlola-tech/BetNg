import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Whistle(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="whistle" {...props} />;
}
