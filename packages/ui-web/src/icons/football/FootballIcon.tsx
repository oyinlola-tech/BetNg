import type { MatchEventKind } from "@betng/ui-core";
import type { FootballIconProps as IconProps } from "./IconBase";
import { eventIcon } from "./eventIcon";

export interface FootballIconByKindProps extends IconProps {
  readonly kind: MatchEventKind;
}

export function FootballIcon({ kind, ...props }: FootballIconByKindProps): React.JSX.Element {
  const Icon = eventIcon(kind);

  return <Icon {...props} />;
}
