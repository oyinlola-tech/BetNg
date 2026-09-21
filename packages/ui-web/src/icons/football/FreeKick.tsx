import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function FreeKick(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="5.5" cy="17.5" r="3" />
      <path d="M12.5 10.5v10M16.5 10.5v10M20.5 10.5v10" />
      <path d="M12.5 6.6h.01M16.5 6.6h.01M20.5 6.6h.01" strokeWidth="2.4" />
    </IconBase>
  );
}
