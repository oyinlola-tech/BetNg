import { CardIcon } from "./CardIcon";
import type { CardIconProps } from "./CardIcon";

export function RedCard(props: CardIconProps): React.JSX.Element {
  return <CardIcon {...props} paint="fill-danger stroke-danger" />;
}
