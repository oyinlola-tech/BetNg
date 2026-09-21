import { CardIcon } from "./CardIcon";
import type { CardIconProps } from "./CardIcon";

export function YellowCard(props: CardIconProps): React.JSX.Element {
  return <CardIcon {...props} paint="fill-warning stroke-warning" />;
}
