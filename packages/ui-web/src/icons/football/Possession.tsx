import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Possession(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="possession" {...props} />;
}
