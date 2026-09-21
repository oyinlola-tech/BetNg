import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Kickoff(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 2v7.6M12 14.4V22" />
    </IconBase>
  );
}
