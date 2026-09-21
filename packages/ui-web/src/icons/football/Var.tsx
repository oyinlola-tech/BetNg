import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Var(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M10.2 7.9v5.2l4.4-2.6z" />
      <path d="M12 17v3.5M8 20.5h8" />
    </IconBase>
  );
}
