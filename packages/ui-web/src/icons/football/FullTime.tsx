import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function FullTime(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12V9.4" />
      <path d="M12 3v1.5" />
    </IconBase>
  );
}
