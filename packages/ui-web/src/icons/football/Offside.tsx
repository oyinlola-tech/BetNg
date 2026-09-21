import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Offside(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M5 21V3.5" />
      <path d="M5 4h9.5v7.5H5" />
      <path d="M9.75 4v7.5M5 7.75h9.5" />
      <path d="M19.5 3v18" strokeDasharray="2.2 3.2" />
    </IconBase>
  );
}
