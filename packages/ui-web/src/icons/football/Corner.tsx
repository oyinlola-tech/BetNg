import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Corner(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M5 21V3" />
      <path d="M5 3.5l8.5 3-8.5 3" />
      <path d="M5 21h16" />
      <path d="M12.5 21A7.5 7.5 0 005 13.5" />
    </IconBase>
  );
}
