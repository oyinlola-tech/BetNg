import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Stadium(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M3 20.5v-5.2l3.2-3h11.6l3.2 3v5.2" />
      <path d="M2 20.5h20" />
      <path d="M9.5 20.5v-3.7h5v3.7" />
      <path d="M6 12.3V5M18 12.3V5" />
      <path d="M4.2 4.2h3.6M16.2 4.2h3.6" />
    </IconBase>
  );
}
