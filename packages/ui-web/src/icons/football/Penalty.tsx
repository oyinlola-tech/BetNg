import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Penalty(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M2.5 5h19" />
      <path d="M9 5V2.5h6V5" />
      <path d="M5 5v11.5h14V5" />
      <path d="M12 11.5h.01" strokeWidth="2.6" />
      <path d="M8.8 16.5a3.4 3.4 0 006.4 0" />
    </IconBase>
  );
}
