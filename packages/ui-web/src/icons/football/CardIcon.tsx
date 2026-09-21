import { cn } from "../../lib/cn";
import { IconBase } from "./IconBase";
import type { FootballIconProps } from "./IconBase";

export interface CardIconProps extends FootballIconProps {
  /** "auto" paints the card in its status colour; "current" follows the text colour. */
  readonly tone?: "auto" | "current";
}

interface CardBodyProps extends CardIconProps {
  readonly paint: string;
}

export function CardIcon({ tone = "auto", paint, ...props }: CardBodyProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <rect
        x="7"
        y="3.5"
        width="10"
        height="17"
        rx="1.75"
        transform="rotate(8 12 12)"
        className={cn(tone === "auto" ? paint : "fill-current stroke-current")}
      />
    </IconBase>
  );
}
