import { Glyph } from "./Glyph";
import type { FootballIconProps } from "./IconBase";

export function Shot(props: FootballIconProps): React.JSX.Element {
  return <Glyph name="shot" {...props} />;
}
