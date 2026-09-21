import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Kickoff(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="kickoff" {...props} />;
}
