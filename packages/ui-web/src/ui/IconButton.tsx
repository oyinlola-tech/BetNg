import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { Tooltip } from "./Tooltip";

export type IconButtonSize = "xs" | "sm" | "md" | "lg";
export type IconButtonVariant = "ghost" | "outline" | "solid";

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "aria-labelledby"
> {
  /** The accessible name. An icon-only control cannot be built without one. */
  readonly label: string;
  readonly size?: IconButtonSize;
  readonly variant?: IconButtonVariant;
  readonly active?: boolean;
  /** `true` shows the label as a styled tooltip; a string shows that text instead. */
  readonly tooltip?: boolean | string;
  readonly tooltipSide?: "top" | "bottom";
}

const SIZES: Record<IconButtonSize, string> = {
  xs: "size-6 [&>svg]:size-3.5 pointer-coarse:after:-inset-2.5",
  sm: "size-8 pointer-coarse:after:-inset-1.5",
  md: "size-10 pointer-coarse:after:-inset-0.5",
  lg: "size-12",
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost:
    "border-transparent text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text-primary",
  outline:
    "border-border-strong bg-surface text-text-primary enabled:hover:bg-surface-hover",
  solid:
    "border-brand bg-brand text-text-on-brand enabled:hover:border-brand-hover enabled:hover:bg-brand-hover",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      size = "md",
      variant = "ghost",
      active = false,
      tooltip = false,
      tooltipSide = "top",
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const tip = tooltip === true ? label : tooltip === false ? undefined : tooltip;

    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        {...(tip === undefined ? { title: label } : {})}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-sm border transition-[background-color,border-color,color,transform] duration-[var(--bn-duration-fast)] focus-ring after:absolute after:content-[''] enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
          SIZES[size],
          VARIANTS[variant],
          active && "border-transparent bg-brand-subtle text-brand",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );

    if (tip === undefined) return button;

    return (
      <Tooltip content={tip} side={tooltipSide} describe={tip !== label}>
        {button}
      </Tooltip>
    );
  },
);
