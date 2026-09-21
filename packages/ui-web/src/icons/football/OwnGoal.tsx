import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function OwnGoal(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M3 20V5h18v15" />
      <path d="M3 9.5h18" />
      <circle cx="8.5" cy="16.5" r="2.5" />
      <path d="M14 18.5h2.5a2.25 2.25 0 000-4.5H13.5" />
      <path d="M15.3 12.2L13.5 14l1.8 1.8" />
    </IconBase>
  );
}
