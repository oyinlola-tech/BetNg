import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export function Substitution(props: FootballIconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M8 20V5" />
      <path d="M4 9l4-4 4 4" />
      <path d="M16 4v15" />
      <path d="M12 15l4 4 4-4" />
    </IconBase>
  );
}
