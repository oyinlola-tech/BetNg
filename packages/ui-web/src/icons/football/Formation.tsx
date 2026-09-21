import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Formation(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="2.5" width="17" height="19" rx="1.5" />
      <path d="M12 18h.01M7.5 13.6h.01M12 13.6h.01M16.5 13.6h.01M9.5 9.4h.01M14.5 9.4h.01M12 5.8h.01" strokeWidth="2.4" />
    </IconBase>
  );
}
