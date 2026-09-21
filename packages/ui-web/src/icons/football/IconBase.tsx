import { useId } from "react";

export interface FootballIconProps {
  readonly size?: number;
  readonly className?: string;
  readonly title?: string;
  readonly strokeWidth?: number;
}

export interface IconBaseProps extends FootballIconProps {
  readonly children: React.ReactNode;
}

export function IconBase({ size = 20, className, title, strokeWidth = 1.75, children }: IconBaseProps): React.JSX.Element {
  const titleId = useId();
  const labelled = title !== undefined && title !== "";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(labelled ? { role: "img", "aria-labelledby": titleId } : { "aria-hidden": true })}
    >
      {labelled ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  );
}
