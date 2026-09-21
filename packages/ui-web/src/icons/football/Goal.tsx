import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Goal(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="goal" {...props} />;
}
