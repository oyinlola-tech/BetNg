import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Football(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8.4l3.42 2.49-1.3 4.02H9.88l-1.3-4.02z" />
      <path d="M12 8.4V3M15.42 10.89l5.14-1.67M14.12 14.91l3.17 4.37M9.88 14.91l-3.17 4.37M8.58 10.89L3.44 9.22" />
    </IconBase>
  );
}
