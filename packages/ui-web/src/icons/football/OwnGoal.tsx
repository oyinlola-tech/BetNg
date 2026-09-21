import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function OwnGoal(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="ownGoal" {...props} />;
}
