import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Foul(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M7 3.5l7.5 17" />
      <path d="M3 16.5l12.5-5" />
      <path d="M17.2 7.2l2.6-2.4M18.6 11.2h3.2M14.4 5.4l.6-3" />
    </IconBase>
  );
}
