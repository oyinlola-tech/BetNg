import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Whistle(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="14.5" r="5.5" />
      <path d="M9 9h12v4h-6.8" />
      <path d="M9 14.5h.01" />
      <path d="M4.2 5.6L3 4M8 4.6V2.6" />
    </IconBase>
  );
}
