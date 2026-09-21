import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Shot(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="15.5" cy="12" r="5.5" />
      <path d="M2.5 8h5M2 12h4M2.5 16h5" />
    </IconBase>
  );
}
