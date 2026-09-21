import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Referee(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="9.5" cy="5.2" r="2.2" />
      <path d="M9.5 8.6v7" />
      <path d="M9.5 15.6l-3 5.9M9.5 15.6l3 5.9" />
      <path d="M9.5 10.6l-3.7 3.2" />
      <path d="M9.5 10.6l5.6-3.2" />
      <rect x="14.6" y="2" width="4" height="5.4" rx="0.6" />
    </IconBase>
  );
}
