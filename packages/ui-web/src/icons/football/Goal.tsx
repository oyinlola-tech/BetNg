import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Goal(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M3 20V5h18v15" />
      <path d="M3 9.5h18M8 5v4.5M12 5v4.5M16 5v4.5" />
      <circle cx="12" cy="16" r="3" />
    </IconBase>
  );
}
