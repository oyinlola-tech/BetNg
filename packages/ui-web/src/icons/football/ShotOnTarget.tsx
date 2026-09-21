import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function ShotOnTarget(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M16.5 4H21v16h-4.5" />
      <circle cx="13" cy="12" r="4" />
      <path d="M2.5 9h4M2 12h3.5M2.5 15h4" />
    </IconBase>
  );
}
