import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Possession(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M12 2.75A9.25 9.25 0 1021.25 12" />
      <circle cx="12" cy="12" r="4.75" />
      <path d="M12 10.1l1.8 1.3-.7 2.1h-2.2l-.7-2.1z" />
    </IconBase>
  );
}
